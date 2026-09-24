import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, WalletCards } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  dhakaPeriod,
  formatDateShort,
  formatTaka,
  formatTimeDhaka,
  percentChange,
  todayInDhaka,
  type MemberDisplayStatus,
  type Period,
} from "@gymnode/core";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { whatsappUrl } from "@/components/members/whatsapp-link";
import { PaymentPanelHost } from "@/components/payments/payment-panel-host";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { MemberStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserId } from "@/lib/auth";
import { FRONT_DESK, MANAGEMENT, gymPackages, hasRole, requireGym } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/urls";
import type { PaymentMember } from "./actions";
import { PaymentRowActions } from "./row-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payments");
  return { title: t("title") };
}

const PERIODS: Period[] = ["today", "week", "month"];
const VIEWS = ["tx", "pending", "dues"] as const;
type View = (typeof VIEWS)[number];
const TX_PAGE = 50;

/** Unverified for more than 24 hours: highlighted for the owner (reminder messages arrive in M6). */
function olderThanADay(iso: string) {
  return new Date(iso).getTime() < Date.now() - 24 * 60 * 60 * 1000;
}

type TxRow = {
  id: string;
  paidAt: string;
  memberId: string | null;
  memberName: string;
  what: string;
  amount: number;
  method: string;
  by: string;
  status: string;
  token: string;
  txn: string | null;
  receivedByMe: boolean;
  overdue: boolean;
};

type DueRow = {
  id: string;
  name: string;
  code: string;
  phone: string;
  due: number;
  endDate: string | null;
  status: MemberDisplayStatus;
};

export default async function PaymentsPage({ searchParams }: PageProps<"/app/payments">) {
  const t = await getTranslations("payments");
  const tm = await getTranslations("methods");
  const ts = await getTranslations("status");
  const tc = await getTranslations("common");
  const membership = await requireGym();
  const te = await getTranslations("errors");
  if (!hasRole(membership, FRONT_DESK)) return <p className="text-muted">{te("forbidden")}</p>;
  const canManage = hasRole(membership, MANAGEMENT);

  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "today";
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "tx";
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);
  const range = dhakaPeriod(period);
  const supabase = await createClient();
  const userId = await getUserId();

  const [stats, prevStats, snapshot, staff, packages, gym] = await Promise.all([
    supabase.rpc("payment_stats", {
      p_gym_id: membership.gymId,
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
    }),
    supabase.rpc("payment_stats", {
      p_gym_id: membership.gymId,
      p_from: range.prevFrom.toISOString(),
      p_to: range.prevTo.toISOString(),
    }),
    supabase.rpc("gym_money_snapshot", { p_gym_id: membership.gymId }),
    supabase.from("gym_users").select("user_id, display_name").eq("gym_id", membership.gymId),
    gymPackages(membership.gymId),
    supabase.from("gyms").select("name").eq("id", membership.gymId).single(),
  ]);
  const cur = (stats.data ?? {}) as { total_paisa?: number; count?: number };
  const prev = (prevStats.data ?? {}) as { total_paisa?: number };
  const snap = (snapshot.data ?? {}) as {
    pending_count?: number;
    pending_paisa?: number;
    pending_overdue_count?: number;
    due_paisa?: number;
    due_members?: number;
  };
  const names = new Map((staff.data ?? []).map((s) => [s.user_id, s.display_name]));
  const change = percentChange(Number(cur.total_paisa ?? 0), Number(prev.total_paisa ?? 0));

  // Optional pre-selected member (e.g. "pay" from the dues list).
  let initialMember: PaymentMember | null = null;
  if (typeof sp.member === "string") {
    const { data: m } = await supabase
      .from("member_overview")
      .select("*")
      .eq("id", sp.member)
      .maybeSingle();
    if (m)
      initialMember = {
        id: m.id!,
        name: m.full_name!,
        code: m.member_code,
        phone: m.phone!,
        status: m.display_status ?? "expired",
        duePaisa: Number(m.due_paisa ?? 0),
        endDate: m.end_date,
        packageId: m.package_id,
        hasMembership: !!m.membership_id,
      };
  }

  // ---- Lists ----
  let txRows: TxRow[] = [];
  let txCount = 0;
  let dueRows: DueRow[] = [];
  if (view === "tx" || view === "pending") {
    let q = supabase
      .from("payments")
      .select(
        "id, paid_at, amount_paisa, method, status, receipt_token, received_by, kind, transaction_id, member_id, members(full_name, member_code), memberships(packages(name))",
        { count: "exact" },
      )
      .eq("gym_id", membership.gymId);
    q =
      view === "pending"
        ? q.eq("status", "pending_verification").order("paid_at", { ascending: true })
        : q
            .gte("paid_at", range.from.toISOString())
            .lt("paid_at", range.to.toISOString())
            .order("paid_at", { ascending: false });
    const { data, count } = await q.range((page - 1) * TX_PAGE, page * TX_PAGE - 1);
    txCount = count ?? 0;
    txRows = (data ?? []).map((p) => {
      const member = p.members as { full_name: string; member_code: string | null } | null;
      const pkg = (p.memberships as { packages: { name: string } | null } | null)?.packages?.name;
      return {
        id: p.id,
        paidAt: p.paid_at,
        memberId: p.member_id,
        memberName: member?.full_name ?? "—",
        what:
          p.kind === "due"
            ? t("kindDue")
            : p.kind === "sale"
              ? t("kindSale")
              : (pkg ?? t("kindOther")),
        amount: p.amount_paisa,
        method: p.method,
        by: names.get(p.received_by ?? "") ?? "—",
        status: p.status,
        token: p.receipt_token,
        txn: p.transaction_id,
        receivedByMe: p.received_by === userId,
        overdue: p.status === "pending_verification" && olderThanADay(p.paid_at),
      };
    });
  } else {
    const { data } = await supabase
      .from("member_overview")
      .select("id, full_name, member_code, phone, due_paisa, end_date, display_status")
      .eq("gym_id", membership.gymId)
      .neq("status", "pending")
      .gt("due_paisa", 0)
      .order("due_paisa", { ascending: false })
      .limit(200);
    dueRows = (data ?? []).map((m) => ({
      id: m.id!,
      name: m.full_name!,
      code: m.member_code ?? "—",
      phone: m.phone!,
      due: Number(m.due_paisa ?? 0),
      endDate: m.end_date,
      status: (m.display_status ?? "due") as MemberDisplayStatus,
    }));
  }

  const statusBadge = (s: string) =>
    s === "completed" ? (
      <Badge tone="green">{ts("completed")}</Badge>
    ) : s === "pending_verification" ? (
      <Badge tone="amber">{ts("pendingVerification")}</Badge>
    ) : (
      <Badge tone="gray">{ts("cancelled")}</Badge>
    );

  const txColumns: Column<TxRow>[] = [
    {
      key: "time",
      header: t("colTime"),
      width: "minmax(max-content, 0.9fr)",
      cell: (r) => {
        const d = new Date(r.paidAt);
        const dayMonth = formatDateShort(d).split(" ").slice(0, 2).join(" ");
        return (
          <span className="num whitespace-nowrap text-muted">
            {period === "today" && view === "tx"
              ? formatTimeDhaka(d)
              : `${dayMonth} · ${formatTimeDhaka(d)}`}
          </span>
        );
      },
    },
    {
      key: "member",
      header: t("colMember"),
      width: "1.8fr",
      primary: true,
      cell: (r) =>
        r.memberId ? (
          <Link href={`/app/members/${r.memberId}`} className="font-semibold hover:underline">
            {r.memberName}
          </Link>
        ) : (
          <span className="font-semibold">{r.memberName}</span>
        ),
    },
    { key: "what", header: t("colPackage"), cell: (r) => r.what },
    {
      key: "amount",
      header: t("colAmount"),
      cell: (r) => <span className="num font-semibold">{formatTaka(r.amount)}</span>,
    },
    {
      key: "method",
      header: t("colMethod"),
      cell: (r) => (
        <span className="flex flex-col">
          <span>{tm(r.method as "cash")}</span>
          {r.txn && view === "pending" ? (
            <span className="num text-xs text-muted">{r.txn}</span>
          ) : null}
        </span>
      ),
    },
    { key: "by", header: t("colBy"), cell: (r) => <span className="text-muted">{r.by}</span> },
    {
      key: "status",
      header: t("colStatus"),
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          {statusBadge(r.status)}
          {r.overdue ? <span className="text-xs text-danger">24h+</span> : null}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only md:not-sr-only">{t("colActions")}</span>,
      width: "200px",
      align: "end",
      mobileFooter: true,
      cell: (r) => (
        <PaymentRowActions
          paymentId={r.id}
          receiptToken={r.token}
          label={`${r.memberName} · ${formatTaka(r.amount)}`}
          canVerify={canManage && r.status === "pending_verification"}
          canCancel={
            r.status !== "cancelled" &&
            (canManage || (r.status === "pending_verification" && r.receivedByMe))
          }
        />
      ),
    },
  ];

  const gymName = gym.data?.name ?? "";
  const dueColumns: Column<DueRow>[] = [
    {
      key: "member",
      header: t("colMember"),
      width: "2fr",
      primary: true,
      cell: (r) => (
        <Link href={`/app/members/${r.id}`} className="font-semibold hover:underline">
          {r.name}
        </Link>
      ),
    },
    { key: "code", header: "ID", cell: (r) => <span className="num text-muted">{r.code}</span> },
    {
      key: "due",
      header: t("colDue"),
      cell: (r) => <span className="num font-semibold text-warning">{formatTaka(r.due)}</span>,
    },
    {
      key: "exp",
      header: t("colExpiry"),
      cell: (r) => (
        <span className="num whitespace-nowrap">
          {r.endDate ? formatDateShort(r.endDate) : "—"}
        </span>
      ),
    },
    { key: "status", header: t("colStatus"), cell: (r) => <MemberStatusBadge status={r.status} /> },
    {
      key: "actions",
      header: <span className="sr-only md:not-sr-only">{t("colActions")}</span>,
      width: "230px",
      align: "end",
      mobileFooter: true,
      cell: (r) => (
        <span className="flex flex-wrap justify-end gap-2">
          <Button asChild size="sm" variant="secondary">
            <a
              href={whatsappUrl(
                r.phone,
                t("remindText", { name: r.name, gym: gymName, amount: formatTaka(r.due) }),
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="text-success" /> {t("remind")}
            </a>
          </Button>
          <Button asChild size="sm">
            <Link href={`/app/payments?view=dues&member=${r.id}`}>{t("payDue")}</Link>
          </Button>
        </span>
      ),
    },
  ];

  const href = (next: Partial<{ period: Period; view: View; page: number }>) => {
    const p = new URLSearchParams();
    const v = next.view ?? view;
    const per = next.period ?? period;
    if (per !== "today") p.set("period", per);
    if (v !== "tx") p.set("view", v);
    if (next.page && next.page > 1) p.set("page", String(next.page));
    return `/app/payments${p.size ? `?${p}` : ""}`;
  };
  const tabLink = (active: boolean) =>
    `flex h-[38px] items-center gap-1.5 rounded-[9px] px-3.5 text-sm ${active ? "bg-accent font-semibold text-on-accent" : "text-muted hover:text-text"}`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
        <nav
          aria-label={t("title")}
          className="inline-flex gap-1.5 rounded-md border border-border bg-surface p-1"
        >
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={href({ period: p, page: 1 })}
              aria-current={p === period ? "page" : undefined}
              className={tabLink(p === period)}
            >
              {t(p)}
            </Link>
          ))}
        </nav>
      </header>

      <div className="grid gap-5 desk:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label={t(`collection_${period}`)}
              value={formatTaka(Number(cur.total_paisa ?? 0))}
              tone="accent"
              sub={
                change !== null
                  ? t(`vsPrevious_${period}`, { change: `${change > 0 ? "+" : ""}${change}` })
                  : t("paymentsCount", { count: String(cur.count ?? 0) })
              }
              subTone={change !== null && change > 0 ? "positive" : "muted"}
            />
            <KpiCard
              label={t("pendingTitle")}
              value={String(snap.pending_count ?? 0)}
              tone={(snap.pending_count ?? 0) > 0 ? "warning" : "default"}
              sub={
                (snap.pending_overdue_count ?? 0) > 0
                  ? t("pendingOverdue", { count: String(snap.pending_overdue_count) })
                  : t("pendingSub", { amount: formatTaka(Number(snap.pending_paisa ?? 0)) })
              }
            />
            <KpiCard
              label={t("duesTitle")}
              value={formatTaka(Number(snap.due_paisa ?? 0))}
              tone="warning"
              sub={t("duesSub", { count: String(snap.due_members ?? 0) })}
            />
          </div>

          <nav
            aria-label={t("title")}
            className="inline-flex max-w-full gap-1.5 self-start overflow-x-auto rounded-md border border-border bg-surface p-1"
          >
            <Link
              href={href({ view: "tx", page: 1 })}
              aria-current={view === "tx" ? "page" : undefined}
              className={tabLink(view === "tx")}
            >
              {t("tabTransactions")}
            </Link>
            <Link
              href={href({ view: "pending", page: 1 })}
              aria-current={view === "pending" ? "page" : undefined}
              className={tabLink(view === "pending")}
            >
              {t("tabPending")}{" "}
              <span className="num text-xs opacity-80">{snap.pending_count ?? 0}</span>
            </Link>
            <Link
              href={href({ view: "dues", page: 1 })}
              aria-current={view === "dues" ? "page" : undefined}
              className={tabLink(view === "dues")}
            >
              {t("tabDues")} <span className="num text-xs opacity-80">{snap.due_members ?? 0}</span>
            </Link>
          </nav>

          {view === "dues" ? (
            dueRows.length ? (
              <ResponsiveTable
                caption={t("tabDues")}
                columns={dueColumns}
                rows={dueRows}
                rowKey={(r) => r.id}
              />
            ) : (
              <EmptyState message={t("emptyDues")} />
            )
          ) : txRows.length ? (
            <ResponsiveTable
              caption={view === "pending" ? t("tabPending") : t("tabTransactions")}
              columns={txColumns}
              rows={txRows}
              rowKey={(r) => r.id}
            />
          ) : (
            <EmptyState
              icon={<WalletCards />}
              message={view === "pending" ? t("emptyPending") : t("emptyTransactions")}
            />
          )}

          {view !== "dues" && txCount > TX_PAGE ? (
            <div className="flex justify-end gap-2">
              {page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={href({ page: page - 1 })}>← {tc("previous")}</Link>
                </Button>
              ) : null}
              {page * TX_PAGE < txCount ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={href({ page: page + 1 })}>{tc("next")} →</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <PaymentPanelHost
          key={initialMember?.id ?? "none"}
          packages={packages}
          today={todayInDhaka()}
          gymName={gymName}
          siteUrl={await siteUrl()}
          initialMember={initialMember}
        />
      </div>
    </div>
  );
}
