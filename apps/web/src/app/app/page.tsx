import type { Metadata } from "next";
import Link from "next/link";
import { PackageX, UserPlus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  addDays,
  formatDateLong,
  formatTaka,
  formatTakaCompact,
  percentChange,
  todayInDhaka,
  type Locale,
  type MemberDisplayStatus,
} from "@gymnode/core";
import { IncomeExpenseChart, type DailyPoint } from "@/components/dashboard/income-expense-chart";
import { LiveCheckins, type CheckinRow } from "@/components/dashboard/live-checkins";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { MemberAvatar } from "@/components/members/member-avatar";
import { WhatsAppIconLink } from "@/components/members/whatsapp-link";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProfile } from "@/lib/auth";
import { FRONT_DESK, MANAGEMENT, hasRole, requireGym } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

type Summary = {
  today_paisa: number;
  yesterday_paisa: number;
  month_paisa: number;
  prev_month_to_date_paisa: number;
  methods_month: Record<string, number>;
  active_members: number;
  new_members_month: number;
  due_paisa: number;
  due_members: number;
  checkins_today: number;
  daily: DailyPoint[];
};

type ExpiringRow = {
  id: string;
  name: string;
  phone: string;
  pkg: string;
  daysLeft: number;
  due: number;
  status: MemberDisplayStatus;
};

const METHOD_ORDER = ["cash", "bkash", "nagad", "rocket", "card"] as const;

function signed(change: number) {
  return `${change > 0 ? "+" : ""}${change}`;
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const tm = await getTranslations("methods");
  const tmem = await getTranslations("members");
  const ts = await getTranslations("shop");
  const locale = (await getLocale()) as Locale;
  const membership = await requireGym();
  const profile = await getProfile();
  const seesMoney = hasRole(membership, FRONT_DESK);
  const seesExpense = hasRole(membership, MANAGEMENT);
  const supabase = await createClient();
  const today = todayInDhaka();

  const [
    { data: summaryData },
    { data: expiringData },
    { data: checkinData },
    { data: lowStockData },
  ] = await Promise.all([
    supabase.rpc("dashboard_summary", { p_gym_id: membership.gymId, p_days: 14 }),
    supabase
      .from("member_overview")
      .select("id, full_name, phone, package_name, days_left, due_paisa, display_status")
      .eq("gym_id", membership.gymId)
      .neq("status", "pending")
      .in("display_status", ["active", "due"])
      .gte("end_date", today)
      .lte("end_date", addDays(today, 7))
      .order("end_date")
      .limit(8),
    supabase
      .from("attendance")
      .select("id, checked_in_at, method, result, reason, members(full_name)")
      .eq("gym_id", membership.gymId)
      .gte("checked_in_at", new Date(`${today}T00:00:00+06:00`).toISOString())
      .order("checked_in_at", { ascending: false })
      .limit(8),
    seesMoney
      ? supabase
          .from("products")
          .select("name")
          .eq("gym_id", membership.gymId)
          .is("deleted_at", null)
          .eq("is_active", true)
          .eq("is_low_stock", true)
          .order("stock_qty")
          .limit(20)
      : Promise.resolve({ data: [] as { name: string }[] }),
  ]);
  const lowStock = lowStockData ?? [];

  const s = summaryData as Summary | null;
  const todayChange = s ? percentChange(s.today_paisa, s.yesterday_paisa) : null;
  const monthChange = s ? percentChange(s.month_paisa, s.prev_month_to_date_paisa) : null;
  const methodsTotal = s ? Object.values(s.methods_month).reduce((a, b) => a + Number(b), 0) : 0;

  const expiring: ExpiringRow[] = (expiringData ?? []).map((m) => ({
    id: m.id!,
    name: m.full_name!,
    phone: m.phone!,
    pkg: m.package_name ?? "—",
    daysLeft: m.days_left ?? 0,
    due: Number(m.due_paisa ?? 0),
    status: (m.display_status ?? "active") as MemberDisplayStatus,
  }));
  const checkins: CheckinRow[] = (checkinData ?? []).map((c) => ({
    id: c.id,
    at: c.checked_in_at,
    name: (c.members as { full_name: string } | null)?.full_name ?? "—",
    method: c.method,
    result: c.result,
    reason: c.reason,
  }));

  const expiringColumns: Column<ExpiringRow>[] = [
    {
      key: "member",
      header: t("colMember"),
      width: "2fr",
      primary: true,
      cell: (r) => (
        <Link
          href={`/app/members/${r.id}`}
          className="flex min-w-0 items-center gap-2.5 hover:underline"
        >
          <MemberAvatar name={r.name} size={34} />
          <span className="truncate font-semibold">{r.name}</span>
        </Link>
      ),
    },
    { key: "pkg", header: t("colPackage"), cell: (r) => r.pkg },
    {
      key: "left",
      header: t("colLeft"),
      cell: (r) => (
        <Badge tone={r.daysLeft <= 0 ? "red" : "amber"}>
          {r.daysLeft <= 0 ? t("leftToday") : t("leftDays", { count: String(r.daysLeft) })}
        </Badge>
      ),
    },
    ...(seesMoney
      ? [
          {
            key: "due",
            header: t("colDue"),
            cell: (r: ExpiringRow) => (
              <span className={r.due > 0 ? "num font-semibold text-warning" : "num text-muted"}>
                {formatTaka(r.due)}
              </span>
            ),
          },
          {
            key: "actions",
            header: <span className="sr-only md:not-sr-only">{t("colActions")}</span>,
            width: "150px",
            align: "end" as const,
            mobileFooter: true,
            cell: (r: ExpiringRow) => (
              <span className="flex justify-end gap-2">
                <WhatsAppIconLink phone={r.phone} label={tmem("whatsappTo", { name: r.name })} />
                <Button asChild size="sm">
                  <Link href={`/app/payments?member=${r.id}`}>{t("renew")}</Link>
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  const noMembersYet =
    s &&
    s.active_members === 0 &&
    s.due_members === 0 &&
    expiring.length === 0 &&
    checkins.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{tn("dashboard")}</h1>
          <p className="text-[15px] text-muted">
            {formatDateLong(new Date(), locale)} ·{" "}
            {t("greeting", { name: profile?.full_name || "" })}
          </p>
        </div>
        {seesMoney ? (
          <Button asChild>
            <Link href="/app/members/new">{tmem("new")}</Link>
          </Button>
        ) : null}
      </header>

      {noMembersYet && seesMoney ? (
        <EmptyState
          icon={<UserPlus />}
          message={tmem("empty")}
          action={
            <Button asChild>
              <Link href="/app/members/new">{tmem("new")}</Link>
            </Button>
          }
        />
      ) : null}

      {lowStock.length ? (
        <Link
          href="/app/sales?tab=stock"
          className="flex items-center gap-2.5 rounded-md bg-badge-amber-bg px-4 py-3 text-sm font-medium text-badge-amber-fg hover:underline"
        >
          <PackageX className="size-[18px] shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {ts("lowStockBanner", { count: String(lowStock.length) })}:{" "}
            {lowStock.map((p) => p.name).join(", ")}
          </span>
          <span className="shrink-0">{ts("lowStockLink")} →</span>
        </Link>
      ) : null}

      {/* KPIs: phones get a 2×2 grid with today's collection as the wide hero tile. */}
      <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
        {seesMoney ? (
          <>
            <KpiCard
              className="col-span-2 desk:col-span-1"
              label={t("todayCollection")}
              value={formatTaka(s?.today_paisa ?? 0)}
              tone="accent"
              sub={
                todayChange !== null
                  ? t("vsYesterday", { change: signed(todayChange) })
                  : t("noChange")
              }
              subTone={todayChange !== null && todayChange > 0 ? "positive" : "muted"}
            />
            <KpiCard
              label={t("monthIncome")}
              value={
                <>
                  <span className="md:hidden">{formatTakaCompact(s?.month_paisa ?? 0)}</span>
                  <span className="hidden md:inline">{formatTaka(s?.month_paisa ?? 0)}</span>
                </>
              }
              sub={
                monthChange !== null ? t("vsLastMonth", { change: signed(monthChange) }) : undefined
              }
              subTone={monthChange !== null && monthChange > 0 ? "positive" : "muted"}
            />
          </>
        ) : (
          <KpiCard label={t("checkinsToday")} value={String(s?.checkins_today ?? 0)} />
        )}
        <KpiCard
          label={t("activeMembers")}
          value={String(s?.active_members ?? 0)}
          sub={t("newThisMonth", { count: String(s?.new_members_month ?? 0) })}
          subTone={(s?.new_members_month ?? 0) > 0 ? "positive" : "muted"}
        />
        {seesMoney ? (
          <KpiCard
            label={t("totalDue")}
            value={formatTaka(s?.due_paisa ?? 0)}
            tone="warning"
            sub={t("dueMembers", { count: String(s?.due_members ?? 0) })}
          />
        ) : null}
        {seesMoney ? (
          // Completes the 2×2 grid on phones/tablets (Dashboard-Mobile.dc.html); desktop shows it in the live card.
          <KpiCard
            className="desk:hidden"
            label={t("checkinsToday")}
            value={String(s?.checkins_today ?? 0)}
          />
        ) : null}
      </div>

      {seesMoney ? (
        <div className="grid gap-5 desk:grid-cols-[2fr_1fr]">
          <Card>
            <IncomeExpenseChart data={s?.daily ?? []} showExpense={seesExpense} />
          </Card>
          <Card className="flex flex-col gap-4">
            <h2 className="text-[17px] font-bold">{t("methodsTitle")}</h2>
            {methodsTotal > 0 ? (
              <>
                <ul className="flex flex-col gap-3">
                  {METHOD_ORDER.filter((m) => Number(s?.methods_month[m] ?? 0) > 0).map((m) => {
                    const amount = Number(s?.methods_month[m] ?? 0);
                    return (
                      <li key={m} className="flex flex-col gap-1.5">
                        <span className="flex items-center justify-between text-sm">
                          <span>{tm(m)}</span>
                          <span className="num font-semibold">{formatTaka(amount)}</span>
                        </span>
                        <span
                          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
                          aria-hidden
                        >
                          <span
                            className="block h-full rounded-full bg-chart-income"
                            style={{ width: `${(amount / methodsTotal) * 100}%` }}
                          />
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                  <span className="text-muted">{t("total")}</span>
                  <span className="num text-xl font-bold">{formatTaka(methodsTotal)}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">{t("noPaymentsYet")}</p>
            )}
          </Card>
        </div>
      ) : null}

      <div className="grid gap-5 desk:grid-cols-[2fr_1fr]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[17px] font-bold">{t("expiringTitle")}</h2>
            <Link
              href="/app/members?tab=active"
              className="text-sm text-accent-text hover:underline"
            >
              {t("seeAll")}
            </Link>
          </div>
          {expiring.length ? (
            <ResponsiveTable
              caption={t("expiringTitle")}
              columns={expiringColumns}
              rows={expiring}
              rowKey={(r) => r.id}
            />
          ) : (
            <EmptyState message={t("noExpiring")} className="py-6" />
          )}
        </section>
        <Card>
          <LiveCheckins
            gymId={membership.gymId}
            initial={checkins}
            canCheckIn={seesMoney}
            canOverride={seesExpense}
          />
        </Card>
      </div>
    </div>
  );
}
