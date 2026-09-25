"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useTranslations } from "next-intl";
import { formatDateShort, formatTaka } from "@gymnode/core";

export type DailyPoint = { date: string; income: number; expense: number };

/**
 * Grouped bars: income (accent) vs expense (secondary), per DESIGN_SYSTEM §6 Charts.
 * 14 days on tablet/desktop, 7 on phones (Dashboard-Mobile.dc.html). Legend + hover
 * tooltip + a screen-reader table, so colour is never the only way to read it.
 */
export function IncomeExpenseChart({
  data,
  showExpense,
}: {
  data: DailyPoint[];
  showExpense: boolean;
}) {
  const t = useTranslations("dashboard");
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const points = narrow ? data.slice(-7) : data;
  const last = points.length - 1;
  const label = (date: string, i: number) =>
    i === last ? t("leftToday") : formatDateShort(date).split(" ").slice(0, 2).join(" ");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold">
          {t("chartTitle", { days: String(points.length) })}
        </h2>
        <ul className="flex gap-4 text-[13px] text-muted" aria-hidden>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-chart-income" /> {t("income")}
          </li>
          {showExpense ? (
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-chart-expense" /> {t("expense")}
            </li>
          ) : null}
        </ul>
      </div>
      <div className="h-52 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={points.map((p, i) => ({ ...p, label: label(p.date, i) }))}
            barGap={2}
            barCategoryGap="22%"
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              interval={0}
              tickFormatter={(v: string, i: number) =>
                i === 0 || i === Math.floor(last / 2) || i === last ? v : ""
              }
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  point={props.payload?.[0]?.payload as DailyPoint | undefined}
                  showExpense={showExpense}
                />
              )}
            />
            <Bar
              dataKey="income"
              fill="var(--chart-income)"
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
            {showExpense ? (
              <Bar
                dataKey="expense"
                fill="var(--chart-expense)"
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
                isAnimationActive={false}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t("chartTable")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("date")}</th>
            <th scope="col">{t("income")}</th>
            {showExpense ? <th scope="col">{t("expense")}</th> : null}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{formatDateShort(p.date)}</th>
              <td>{formatTaka(p.income)}</td>
              {showExpense ? <td>{formatTaka(p.expense)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartTooltip({
  active,
  point,
  showExpense,
}: {
  active?: boolean;
  point?: DailyPoint;
  showExpense: boolean;
}) {
  const t = useTranslations("dashboard");
  if (!active || !point) return null;
  const p = point;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text shadow-sm">
      <p className="mb-1 font-semibold">{formatDateShort(p.date)}</p>
      <p className="flex items-center gap-2">
        <span className="size-2.5 rounded-[3px] bg-chart-income" aria-hidden />
        {t("income")} <span className="num ml-auto pl-3 font-semibold">{formatTaka(p.income)}</span>
      </p>
      {showExpense ? (
        <p className="flex items-center gap-2">
          <span className="size-2.5 rounded-[3px] bg-chart-expense" aria-hidden />
          {t("expense")}{" "}
          <span className="num ml-auto pl-3 font-semibold">{formatTaka(p.expense)}</span>
        </p>
      ) : null}
    </div>
  );
}
