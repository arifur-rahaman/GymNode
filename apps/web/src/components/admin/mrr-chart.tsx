"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useTranslations } from "next-intl";
import { formatTaka } from "@gymnode/core";

export type MrrPoint = {
  month: string;
  label: string;
  fullLabel: string;
  billed: number;
  collected: number;
};

/**
 * 12 months of subscription billing (SA-Dashboard.dc.html): one series, the current month
 * highlighted. Tooltip + screen-reader table carry the numbers.
 */
export function MrrChart({ data }: { data: MrrPoint[] }) {
  const t = useTranslations("admin");
  const last = data.length - 1;
  return (
    <div className="flex flex-col gap-2">
      <div className="h-52 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
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
              content={(props) => {
                const p = props.payload?.[0]?.payload as MrrPoint | undefined;
                if (!props.active || !p) return null;
                return (
                  <div className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text shadow-sm">
                    <p className="mb-1 font-semibold">{p.fullLabel}</p>
                    <p className="flex gap-3">
                      {t("billed")}{" "}
                      <span className="num ml-auto font-semibold">{formatTaka(p.billed)}</span>
                    </p>
                    <p className="flex gap-3">
                      {t("collected")}{" "}
                      <span className="num ml-auto font-semibold">{formatTaka(p.collected)}</span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="billed" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell
                  key={d.month}
                  fill={i === last ? "var(--chart-income)" : "var(--chart-muted)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t("mrrTable")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("month")}</th>
            <th scope="col">{t("billed")}</th>
            <th scope="col">{t("collected")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{d.fullLabel}</th>
              <td>{formatTaka(d.billed)}</td>
              <td>{formatTaka(d.collected)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
