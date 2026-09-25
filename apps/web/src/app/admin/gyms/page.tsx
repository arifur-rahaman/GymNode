import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatDateShort, formatTaka } from "@gymnode/core";
import { GymStatusBadge } from "@/components/admin/gym-status-badge";
import { EmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("gymsTitle") };
}

const STATUSES = ["active", "trial", "past_due", "suspended"] as const;
const PAGE = 25;

type Row = {
  id: string;
  name: string;
  code_prefix: string;
  city: string;
  owner_name: string;
  owner_email: string | null;
  plan_name: string | null;
  status: string;
  members: number;
  monthly_price: number | null;
  last_login: string | null;
  created_at: string;
};

type Result = {
  counts: Record<"all" | (typeof STATUSES)[number], number>;
  cities: string[];
  total: number;
  rows: Row[];
};

function daysAgo(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default async function AdminGymsPage({ searchParams }: PageProps<"/admin/gyms">) {
  const t = await getTranslations("admin");
  const te = await getTranslations("errors");
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number])
    ? (sp.status as string)
    : null;
  const city = typeof sp.city === "string" && sp.city ? sp.city : null;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_gyms", {
    p_status: status as string,
    p_city: city as string,
    p_q: q,
    p_limit: PAGE,
    p_offset: (page - 1) * PAGE,
  });
  const r = data as Result | null;
  if (!r) return <p className="text-muted">{te("unknown")}</p>;

  const href = (next: { status?: string | null; page?: number }) => {
    const p = new URLSearchParams();
    const st = next.status === undefined ? status : next.status;
    if (st) p.set("status", st);
    if (city) p.set("city", city);
    if (q) p.set("q", q);
    if (next.page && next.page > 1) p.set("page", String(next.page));
    return `/admin/gyms${p.size ? `?${p}` : ""}`;
  };

  const lastLogin = (iso: string | null) => {
    const d = daysAgo(iso);
    if (d === null) return "—";
    if (d === 0) return t("today");
    if (d === 1) return t("yesterday");
    return t("daysAgo", { count: String(d) });
  };

  const columns: Column<Row>[] = [
    {
      key: "gym",
      header: t("colGymOwner"),
      width: "2fr",
      primary: true,
      cell: (g) => (
        <Link
          href={`/admin/gyms/${g.id}`}
          className="flex min-w-0 items-center gap-2.5 hover:underline"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-xs font-bold"
          >
            {g.code_prefix}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{g.name}</span>
            <span className="truncate text-xs text-muted">
              {g.owner_name || g.owner_email || "—"}
            </span>
          </span>
        </Link>
      ),
    },
    { key: "city", header: t("colCity"), cell: (g) => g.city || "—" },
    { key: "plan", header: t("colPlan"), cell: (g) => g.plan_name ?? t("noPlan") },
    {
      key: "members",
      header: t("colMembers"),
      cell: (g) => <span className="num">{g.members}</span>,
    },
    {
      key: "bill",
      header: t("colBill"),
      cell: (g) => (
        <span className="num">
          {g.monthly_price !== null ? formatTaka(Number(g.monthly_price)) : "—"}
        </span>
      ),
    },
    {
      key: "login",
      header: t("colLastLogin"),
      cell: (g) => {
        const d = daysAgo(g.last_login);
        return (
          <span className={d !== null && d > 14 ? "text-danger" : "text-muted"}>
            {lastLogin(g.last_login)}
          </span>
        );
      },
    },
    { key: "status", header: t("colStatus"), cell: (g) => <GymStatusBadge status={g.status} /> },
    {
      key: "joined",
      header: t("colJoined"),
      hideOnMobile: true,
      cell: (g) => (
        <span className="num text-muted">{formatDateShort(new Date(g.created_at))}</span>
      ),
    },
  ];

  const pages = Math.max(1, Math.ceil(r.total / PAGE));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">
          {t("gymsTitle")} <span className="num text-muted">{r.counts.all}</span>
        </h1>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <LinkTabs
          label={t("gymsTitle")}
          items={[null, ...STATUSES].map((s) => ({
            href: href({ status: s, page: 1 }),
            label: t(s ? `tab_${s}` : "tab_all"),
            active: status === s,
            count: r.counts[s ?? "all"],
          }))}
        />
        <form method="get" className="flex flex-1 flex-wrap items-center gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label className="flex h-11 min-w-48 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 focus-within:border-accent">
            <Search className="size-[18px] text-muted" aria-hidden />
            <span className="sr-only">{t("searchGyms")}</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={t("searchGyms")}
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
            />
          </label>
          <label className="w-44">
            <span className="sr-only">{t("colCity")}</span>
            <NativeSelect name="city" defaultValue={city ?? ""} className="h-11">
              <option value="">{t("allCities")}</option>
              {r.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button type="submit" variant="secondary">
            {t("filter")}
          </Button>
        </form>
      </div>

      {r.rows.length ? (
        <ResponsiveTable
          caption={t("gymsTitle")}
          columns={columns}
          rows={r.rows}
          rowKey={(g) => g.id}
        />
      ) : (
        <EmptyState message={t("noGyms")} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span className="num">
          {r.total
            ? `${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, r.total)} / ${r.total}`
            : "0"}
        </span>
        <span className="flex gap-2">
          {page > 1 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={href({ page: page - 1 })}>{t("prev")}</Link>
            </Button>
          ) : null}
          {page < pages ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={href({ page: page + 1 })}>{t("next")}</Link>
            </Button>
          ) : null}
        </span>
      </div>
      <p className="text-[13px] text-muted">{t("supportHint")}</p>
    </div>
  );
}
