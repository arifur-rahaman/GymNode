import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Download, UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  formatDateShort,
  formatTaka,
  maskBdPhone,
  toLocalBdPhone,
  type MemberDisplayStatus,
} from "@gymnode/core";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/members/member-avatar";
import { WhatsAppIconLink } from "@/components/members/whatsapp-link";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { MemberStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FRONT_DESK, gymPackages, hasRole, requireGym, signedPhotoUrls } from "@/lib/gym-context";
import { memberQuery, PAGE_SIZE, parseMemberListParams } from "@/lib/member-list";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/urls";
import { ApprovalsList } from "./approvals-list";
import { MembersToolbar } from "./members-toolbar";
import { QrDialog } from "./qr-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("members");
  return { title: t("title") };
}

type Row = {
  id: string;
  name: string;
  phone: string;
  code: string;
  pkg: string;
  endDate: string | null;
  status: MemberDisplayStatus;
  duePaisa: number;
  pendingPayment: boolean;
  face: boolean;
  finger: boolean;
  photoUrl: string | null;
};

export default async function MembersPage({ searchParams }: PageProps<"/app/members">) {
  const t = await getTranslations("members");
  const tc = await getTranslations("common");
  const membership = await requireGym();
  const params = parseMemberListParams(await searchParams);
  const frontDesk = hasRole(membership, FRONT_DESK);
  const supabase = await createClient();

  const [{ data, count }, { data: counts }, packages, gym] = await Promise.all([
    memberQuery(membership.gymId, params),
    supabase.rpc("member_status_counts", { p_gym_id: membership.gymId }),
    gymPackages(membership.gymId, { activeOnly: false }),
    supabase.from("gyms").select("slug").eq("id", membership.gymId).single(),
  ]);

  const countOf = (s: string) => Number(counts?.find((c) => c.status === s)?.total ?? 0);
  const total = ["active", "due", "expired", "frozen"].reduce((sum, s) => sum + countOf(s), 0);
  const photos = await signedPhotoUrls((data ?? []).map((m) => m.photo_path));

  const rows: Row[] = (data ?? []).map((m) => ({
    id: m.id!,
    name: m.full_name!,
    phone: m.phone!,
    code: m.member_code ?? "—",
    pkg: m.package_name ?? "—",
    endDate: m.end_date,
    status: (m.display_status ?? "expired") as MemberDisplayStatus,
    duePaisa: Number(m.due_paisa ?? 0),
    pendingPayment: !!m.has_pending_payment,
    face: !!m.face_enrolled,
    finger: !!m.fingerprint_enrolled,
    photoUrl: m.photo_path ? (photos.get(m.photo_path) ?? null) : null,
  }));

  // Trainers see masked numbers (PLAN.md §4.7).
  const showPhone = (p: string) => (frontDesk ? toLocalBdPhone(p) : maskBdPhone(p));
  const biometric = (r: Row) =>
    r.face && r.finger
      ? `${t("face")} + ${t("finger")}`
      : r.face
        ? t("face")
        : r.finger
          ? t("finger")
          : t("noBiometric");

  const columns: Column<Row>[] = [
    {
      key: "member",
      header: t("colMember"),
      width: "2.4fr",
      primary: true,
      cell: (r) => (
        <Link
          href={`/app/members/${r.id}`}
          className="flex min-w-0 items-center gap-2.5 hover:underline"
        >
          <MemberAvatar name={r.name} photoUrl={r.photoUrl} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{r.name}</span>
            <span className="num text-xs text-muted">{showPhone(r.phone)}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "id",
      header: t("colId"),
      cell: (r) => <span className="num text-muted">{r.code}</span>,
    },
    { key: "pkg", header: t("colPackage"), width: "1.2fr", cell: (r) => r.pkg },
    {
      key: "exp",
      header: t("colExpiry"),
      width: "1.2fr",
      cell: (r) => (
        <span className="num whitespace-nowrap">
          {r.endDate ? formatDateShort(r.endDate) : "—"}
        </span>
      ),
    },
    { key: "status", header: t("colStatus"), cell: (r) => <MemberStatusBadge status={r.status} /> },
    {
      key: "due",
      header: t("colDue"),
      cell: (r) => (
        <span className="flex flex-col items-start gap-0.5">
          <span className={r.duePaisa > 0 ? "num font-semibold text-warning" : "num text-muted"}>
            {formatTaka(r.duePaisa)}
          </span>
          {r.pendingPayment ? <Badge tone="amber">{t("pendingCheck")}</Badge> : null}
        </span>
      ),
    },
    {
      key: "bio",
      header: t("colBiometric"),
      hideOnMobile: true,
      cell: (r) => <span className="text-muted">{biometric(r)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only md:not-sr-only">{t("colActions")}</span>,
      width: "96px",
      align: "end",
      mobileFooter: true,
      cell: (r) => (
        <span className="flex justify-end gap-2">
          {frontDesk ? (
            <WhatsAppIconLink phone={r.phone} label={t("whatsappTo", { name: r.name })} />
          ) : null}
          <Link
            href={`/app/members/${r.id}`}
            aria-label={t("open", { name: r.name })}
            className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-surface hover:bg-surface-2"
          >
            <ChevronRight className="size-[18px]" aria-hidden />
          </Link>
        </span>
      ),
    },
  ];

  const from = count ? (params.page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(params.page * PAGE_SIZE, count ?? 0);
  const pageHref = (page: number) => {
    const sp = new URLSearchParams();
    if (params.tab !== "all") sp.set("tab", params.tab);
    if (params.q) sp.set("q", params.q);
    if (params.pkg) sp.set("pkg", params.pkg);
    if (page > 1) sp.set("page", String(page));
    const s = sp.toString();
    return `/app/members${s ? `?${s}` : ""}`;
  };
  const exportParams = new URLSearchParams(pageHref(1).split("?")[1] ?? "");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
          <span className="num text-[15px] text-muted">
            {t("summary", { total: String(total), active: String(countOf("active")) })}
          </span>
        </div>
        {frontDesk ? (
          <div className="flex flex-wrap gap-2.5">
            <Button asChild variant="secondary">
              <a href={`/app/members/export?${exportParams.toString()}`} download>
                <Download /> {t("export")}
              </a>
            </Button>
            <QrDialog url={`${await siteUrl()}/join/${gym.data?.slug ?? ""}`} />
            <Button asChild>
              <Link href="/app/members/new">{t("new")}</Link>
            </Button>
          </div>
        ) : null}
      </header>

      <MembersToolbar
        params={params}
        counts={{
          all: total,
          active: countOf("active"),
          due: countOf("due"),
          expired: countOf("expired"),
          frozen: countOf("frozen"),
          pending: countOf("pending"),
        }}
        packages={packages.map((p) => ({ id: p.id, name: p.name }))}
        showPending={frontDesk}
      />

      {params.tab === "pending" ? (
        <ApprovalsList
          rows={rows.map((r) => ({ id: r.id, name: r.name, phone: toLocalBdPhone(r.phone) }))}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<UserPlus />}
          message={params.q || params.pkg || params.tab !== "all" ? t("noResults") : t("empty")}
          action={
            frontDesk && !params.q ? (
              <Button asChild>
                <Link href="/app/members/new">{t("new")}</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <ResponsiveTable caption={t("title")} columns={columns} rows={rows} rowKey={(r) => r.id} />
      )}

      {count && count > PAGE_SIZE ? (
        <nav aria-label={t("title")} className="flex items-center justify-between gap-3">
          <span className="num text-sm text-muted">
            {t("pageInfo", { from: String(from), to: String(to), total: String(count) })}
          </span>
          <div className="flex gap-2">
            {params.page > 1 ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={pageHref(params.page - 1)}>← {tc("previous")}</Link>
              </Button>
            ) : null}
            {to < count ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={pageHref(params.page + 1)}>{tc("next")} →</Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
