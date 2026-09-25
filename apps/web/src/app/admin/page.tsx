import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatMonth, formatTaka, percentChange, type Locale } from "@gymnode/core";
import { GymStatusBadge } from "@/components/admin/gym-status-badge";
import { MrrChart } from "@/components/admin/mrr-chart";
import { BarList } from "@/components/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("dashboardTitle") };
}

type Overview = {
  gyms: number;
  new_this_month: number;
  mrr_paisa: number;
  mrr_unpriced: number;
  trials: number;
  trials_ending_week: number;
  overdue_invoices: number;
  overdue_paisa: number;
  overdue_week: number;
  churn_month: number;
  churn_base: number;
  plans: { code: string; name: string; count: number }[];
  mrr_history: { month: string; billed: number; collected: number }[];
  recent: {
    id: string;
    name: string;
    city: string;
    plan_name: string | null;
    status: string;
    trial_ends_at: string | null;
    members: number;
  }[];
  open_tickets: number;
  urgent_tickets: number;
};

type Recent = Overview["recent"][number];

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin");
  const te = await getTranslations("errors");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_overview");
  const o = data as Overview | null;
  if (!o) return <p className="text-muted">{te("unknown")}</p>;

  const history = o.mrr_history.map((m) => ({
    month: m.month,
    label: formatMonth(m.month, locale, { style: "short", withYear: false }),
    fullLabel: formatMonth(m.month, locale),
    billed: Number(m.billed),
    collected: Number(m.collected),
  }));
  const thisMonth = history.at(-1)?.billed ?? 0;
  const lastMonth = history.at(-2)?.billed ?? 0;
  const mrrChange = percentChange(thisMonth, lastMonth);
  const churnPct = o.churn_base ? Math.round((o.churn_month / o.churn_base) * 100) : 0;

  const alerts = [
    o.overdue_week > 0 && {
      tone: "bg-warning",
      title: t("alertOverdue", { count: String(o.overdue_week) }),
      desc: t("alertOverdueDesc"),
      href: "/admin/billing?status=overdue",
    },
    o.open_tickets > 0 && {
      tone: o.urgent_tickets ? "bg-danger" : "bg-warning",
      title: t("alertTickets", { count: String(o.open_tickets) }),
      desc: t("alertTicketsDesc", { count: String(o.urgent_tickets) }),
      href: "/admin/support",
    },
    o.trials_ending_week > 0 && {
      tone: "bg-info",
      title: t("alertTrials", { count: String(o.trials_ending_week) }),
      desc: t("alertTrialsDesc"),
      href: "/admin/gyms?status=trial",
    },
  ].filter(Boolean) as { tone: string; title: string; desc: string; href: string }[];

  const columns: Column<Recent>[] = [
    {
      key: "name",
      header: t("colGym"),
      width: "1.6fr",
      primary: true,
      cell: (r) => (
        <Link href={`/admin/gyms/${r.id}`} className="font-semibold hover:underline">
          {r.name}
        </Link>
      ),
    },
    { key: "city", header: t("colCity"), cell: (r) => r.city || "—" },
    { key: "plan", header: t("colPlan"), cell: (r) => r.plan_name ?? t("noPlan") },
    {
      key: "members",
      header: t("colMembers"),
      cell: (r) => <span className="num">{r.members}</span>,
    },
    { key: "status", header: t("colStatus"), cell: (r) => <GymStatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">
            {t("dashboardTitle")}
          </h1>
          <p className="text-[15px] text-muted">
            {t("dashboardSub", {
              month: formatMonth(history.at(-1)?.month ?? "2026-01-01", locale),
            })}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 desk:grid-cols-5">
        <KpiCard
          label={t("kpiGyms")}
          value={String(o.gyms)}
          sub={t("kpiGymsSub", { count: String(o.new_this_month) })}
          subTone={o.new_this_month > 0 ? "positive" : "muted"}
        />
        <KpiCard
          label="MRR"
          value={formatTaka(Number(o.mrr_paisa))}
          tone="accent"
          sub={
            o.mrr_unpriced ? t("kpiMrrUnpriced", { count: String(o.mrr_unpriced) }) : t("kpiMrrSub")
          }
        />
        <KpiCard
          label={t("kpiTrials")}
          value={String(o.trials)}
          tone="info"
          sub={t("kpiTrialsSub", { count: String(o.trials_ending_week) })}
        />
        <KpiCard
          label={t("kpiOverdue")}
          value={String(o.overdue_invoices)}
          tone="warning"
          sub={formatTaka(Number(o.overdue_paisa))}
        />
        <KpiCard
          label={t("kpiChurn")}
          value={String(o.churn_month)}
          tone="danger"
          sub={t("kpiChurnSub", { pct: String(churnPct) })}
        />
      </div>

      <div className="grid gap-5 desk:grid-cols-[2fr_1fr]">
        <Card className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold">{t("mrrTitle")}</h2>
            {mrrChange !== null ? (
              <span className={`num text-sm ${mrrChange >= 0 ? "text-success" : "text-danger"}`}>
                {t("mrrChange", { change: `${mrrChange > 0 ? "+" : ""}${mrrChange}` })}
              </span>
            ) : null}
          </div>
          <p className="text-[13px] text-muted">{t("mrrHint")}</p>
          <MrrChart data={history} />
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="text-[17px] font-bold">{t("plansTitle")}</h2>
          <BarList
            barClassName="bg-chart-income"
            items={[
              ...o.plans.map((p) => ({
                key: p.code,
                label: p.name,
                value: p.count,
                display: String(p.count),
              })),
              { key: "trial", label: t("trial"), value: o.trials, display: String(o.trials) },
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-5 desk:grid-cols-[2fr_1fr]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[17px] font-bold">{t("recentTitle")}</h2>
            <Link href="/admin/gyms" className="text-sm text-accent-text hover:underline">
              {t("allGyms")}
            </Link>
          </div>
          <ResponsiveTable
            caption={t("recentTitle")}
            columns={columns}
            rows={o.recent}
            rowKey={(r) => r.id}
          />
        </section>
        <Card className="flex flex-col gap-3 self-start">
          <h2 className="text-[17px] font-bold">{t("alertsTitle")}</h2>
          {alerts.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {alerts.map((a) => (
                <li key={a.title}>
                  <Link href={a.href} className="flex items-start gap-3 py-3 hover:underline">
                    <span
                      className={`mt-1.5 size-2.5 shrink-0 rounded-full ${a.tone}`}
                      aria-hidden
                    />
                    <span className="flex flex-col">
                      <span className="font-semibold">{a.title}</span>
                      <span className="text-[13px] text-muted">{a.desc}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("noAlerts")}</p>
          )}
          <p className="text-[13px] text-muted">{t("devicesLater")}</p>
        </Card>
      </div>
    </div>
  );
}
