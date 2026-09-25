import type { Metadata } from "next";
import { FileSpreadsheet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  formatDateShort,
  formatMonth,
  formatTaka,
  formatTakaCompact,
  percentChange,
  REPORT_PRESETS,
  type Locale,
} from "@gymnode/core";
import { BarList } from "@/components/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { LinkTabs } from "@/components/link-tabs";
import { GroupedBars } from "@/components/reports/grouped-bars";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MANAGEMENT, hasRole, requireGym } from "@/lib/gym-context";
import { PrintButton } from "@/app/r/[token]/print-button";
import { hourSlot, loadReport, parseRange } from "./report-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports");
  return { title: t("title") };
}

export default async function ReportsPage({ searchParams }: PageProps<"/app/reports">) {
  const t = await getTranslations("reports");
  const te = await getTranslations("errors");
  const tm = await getTranslations("methods");
  const locale = (await getLocale()) as Locale;
  const membership = await requireGym();
  if (!hasRole(membership, MANAGEMENT)) return <p className="text-muted">{te("forbidden")}</p>;

  const sp = await searchParams;
  const { preset, range, invalid } = parseRange(sp);
  const r = await loadReport(membership.gymId, range);
  if (!r) return <p className="text-muted">{te("unknown")}</p>;

  const net = r.income_paisa - r.expense_paisa;
  const incomeChange = percentChange(r.income_paisa, r.prev_income_paisa);
  const renewRate = r.ended_memberships
    ? Math.round((r.renewed_memberships / r.ended_memberships) * 100)
    : null;
  const query = new URLSearchParams({ range: preset });
  if (preset === "custom") {
    query.set("from", range.from);
    query.set("to", range.to);
  }
  const period = t("period", { from: formatDateShort(range.from), to: formatDateShort(range.to) });
  const peakMax = r.peak_hours.length ? r.peak_hours : [];
  const methodsTotal = Object.values(r.methods).reduce((a, b) => a + Number(b), 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
          <p className="num text-sm text-muted">
            {period}
            <span className="hidden print:inline"> · {membership.gym.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <LinkTabs
            label={t("title")}
            items={REPORT_PRESETS.map((p) => ({
              href: p === "6m" ? "/app/reports" : `/app/reports?range=${p}`,
              label: t(`range_${p}`),
              active: preset === p,
            }))}
          />
          <PrintButton label={t("pdf")} />
          <Button asChild variant="secondary">
            <a href={`/app/reports/export?${query}`} download>
              <FileSpreadsheet /> {t("excel")}
            </a>
          </Button>
        </div>
      </header>

      {preset === "custom" ? (
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 print:hidden"
        >
          <input type="hidden" name="range" value="custom" />
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("from")}
            <Input type="date" name="from" defaultValue={range.from} className="num" required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("to")}
            <Input type="date" name="to" defaultValue={range.to} className="num" required />
          </label>
          <Button type="submit">{t("apply")}</Button>
          {invalid ? <p className="w-full text-sm text-danger">{te("invalidRange")}</p> : null}
        </form>
      ) : null}
      <p className="hidden text-sm text-muted print:block">{t("pdfHint")}</p>

      <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
        <KpiCard
          label={t("totalIncome")}
          value={
            <>
              <span className="md:hidden">{formatTakaCompact(r.income_paisa)}</span>
              <span className="hidden md:inline">{formatTaka(r.income_paisa)}</span>
            </>
          }
          tone="accent"
          sub={
            incomeChange !== null
              ? t("vsPrevious", { change: `${incomeChange > 0 ? "+" : ""}${incomeChange}` })
              : t("noPrevious")
          }
          subTone={incomeChange !== null && incomeChange > 0 ? "positive" : "muted"}
        />
        <KpiCard
          label={t("totalExpense")}
          value={
            <>
              <span className="md:hidden">{formatTakaCompact(r.expense_paisa)}</span>
              <span className="hidden md:inline">{formatTaka(r.expense_paisa)}</span>
            </>
          }
          sub={
            r.expense_categories.length
              ? t("expenseSub", {
                  top: r.expense_categories
                    .slice(0, 3)
                    .map((c) => c.name)
                    .join(", "),
                })
              : undefined
          }
        />
        <KpiCard
          label={net >= 0 ? t("netProfit") : t("netLoss")}
          value={
            <>
              <span className="md:hidden">{formatTakaCompact(net)}</span>
              <span className="hidden md:inline">{formatTaka(net)}</span>
            </>
          }
          tone={net >= 0 ? "success" : "danger"}
          sub={
            r.income_paisa > 0
              ? t("margin", { pct: String(Math.round((net / r.income_paisa) * 100)) })
              : undefined
          }
        />
        <KpiCard
          label={t("renewRate")}
          value={renewRate !== null ? `${renewRate}%` : "—"}
          sub={
            renewRate !== null
              ? t("renewSub", {
                  renewed: String(r.renewed_memberships),
                  ended: String(r.ended_memberships),
                })
              : t("renewNone")
          }
        />
      </div>
      {membership.role === "manager" ? (
        <p className="text-sm text-muted">{t("salaryHidden")}</p>
      ) : null}

      <div className="grid gap-5 desk:grid-cols-3">
        <Card className="min-w-0 desk:col-span-2 print:break-inside-avoid">
          <GroupedBars
            title={t("monthlyTitle")}
            rows={r.monthly.map((m) => {
              const profit = m.income - m.expense;
              return {
                key: m.month,
                label: formatMonth(m.month, locale, { style: "short", withYear: false }),
                fullLabel: formatMonth(m.month, locale),
                values: { income: m.income, expense: m.expense },
                note: {
                  text: formatTakaCompact(profit),
                  tone: profit >= 0 ? "positive" : "negative",
                },
              };
            })}
            series={[
              {
                key: "income",
                name: t("income"),
                color: "var(--chart-income)",
                swatch: "bg-chart-income",
              },
              {
                key: "expense",
                name: t("expense"),
                color: "var(--chart-expense)",
                swatch: "bg-chart-expense",
              },
            ]}
            valueFormat="taka"
            tableCaption={t("monthlyTable")}
            labelHeader={t("month")}
          />
        </Card>
        <Card className="flex flex-col gap-4 print:break-inside-avoid">
          <h2 className="text-[17px] font-bold">{t("categoriesTitle")}</h2>
          {r.expense_categories.length ? (
            <BarList
              items={r.expense_categories.map((c) => ({
                key: c.name,
                label: c.name,
                value: Number(c.total),
                display: formatTaka(Number(c.total)),
              }))}
            />
          ) : (
            <p className="text-sm text-muted">{t("noExpenses")}</p>
          )}
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2 desk:grid-cols-3">
        <Card className="min-w-0 print:break-inside-avoid">
          <GroupedBars
            title={t("membersTitle")}
            hint={t("membersHint")}
            rows={r.monthly.map((m) => ({
              key: m.month,
              label: formatMonth(m.month, locale, { style: "short", withYear: false }),
              fullLabel: formatMonth(m.month, locale),
              values: { new: m.new_members, lost: m.lost_members },
            }))}
            series={[
              {
                key: "new",
                name: t("newMembers"),
                color: "var(--chart-income)",
                swatch: "bg-chart-income",
              },
              {
                key: "lost",
                name: t("lostMembers"),
                color: "var(--chart-expense)",
                swatch: "bg-chart-expense",
              },
            ]}
            valueFormat="count"
            tableCaption={t("membersTable")}
            labelHeader={t("month")}
            heightClass="h-44"
          />
        </Card>
        <Card className="flex flex-col gap-3 print:break-inside-avoid">
          <h2 className="text-[17px] font-bold">{t("packagesTitle")}</h2>
          {r.packages.length ? (
            <ul className="flex flex-col">
              {r.packages.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-0"
                >
                  <span>{p.name}</span>
                  <span className="num font-semibold">
                    {t("packagesCount", { count: String(p.count) })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("noPackages")}</p>
          )}
        </Card>
        <Card className="flex flex-col gap-3 print:break-inside-avoid">
          <div>
            <h2 className="text-[17px] font-bold">{t("peakTitle")}</h2>
            <p className="num text-[13px] text-muted">
              {t("peakHint")} · {t("checkinsCount", { count: String(r.checkins) })}
            </p>
          </div>
          {peakMax.length ? (
            <BarList
              labelWidth="96px"
              barClassName="bg-chart-income"
              items={r.peak_hours.map((p) => ({
                key: String(p.hour),
                label: hourSlot(p.hour),
                value: p.count,
                display: String(p.count),
              }))}
            />
          ) : (
            <p className="text-sm text-muted">{t("noCheckins")}</p>
          )}
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col gap-3 print:break-inside-avoid">
          <div>
            <h2 className="text-[17px] font-bold">{t("productsTitle")}</h2>
            <p className="num text-[13px] text-muted">
              {t("salesSub", { amount: formatTaka(r.sales_paisa) })}
            </p>
          </div>
          {r.products.length ? (
            <ul className="flex flex-col">
              {r.products.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
                >
                  <span className="min-w-0 truncate">
                    {p.name} <span className="num text-muted">×{p.qty}</span>
                  </span>
                  <span className="num font-semibold">{formatTaka(Number(p.total))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("noSales")}</p>
          )}
        </Card>
        <Card className="flex flex-col gap-3 print:break-inside-avoid">
          <h2 className="text-[17px] font-bold">{t("methodsTitle")}</h2>
          {methodsTotal > 0 ? (
            <BarList
              barClassName="bg-chart-income"
              items={(["cash", "bkash", "nagad", "rocket", "card"] as const)
                .filter((m) => Number(r.methods[m] ?? 0) > 0)
                .map((m) => ({
                  key: m,
                  label: tm(m),
                  value: Number(r.methods[m]),
                  display: formatTaka(Number(r.methods[m])),
                }))}
            />
          ) : (
            <p className="text-sm text-muted">{t("noPayments")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
