"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { formatTaka } from "@gymnode/core";

export type GroupedRow = {
  key: string;
  /** Axis label ("সেপ্ট"). */
  label: string;
  /** Full label for the tooltip and table ("সেপ্টেম্বর 2026"). */
  fullLabel: string;
  values: Record<string, number>;
  /** Optional text above the group (monthly profit in Reports.dc.html). */
  note?: { text: string; tone: "positive" | "negative" };
};

export type Series = { key: string; name: string; color: string; swatch: string };

/**
 * Two-series grouped bars with a legend, hover tooltip and a screen-reader table,
 * so colour is never the only way to read it (same pattern as the dashboard chart).
 */
export function GroupedBars({
  title,
  hint,
  rows,
  series,
  valueFormat,
  tableCaption,
  labelHeader,
  heightClass = "h-56",
}: {
  title: string;
  hint?: string;
  rows: GroupedRow[];
  series: Series[];
  /** Server pages can't pass functions to client components, so the format is named. */
  valueFormat: "taka" | "count";
  tableCaption: string;
  labelHeader: string;
  heightClass?: string;
}) {
  const format = (v: number) => (valueFormat === "taka" ? formatTaka(v) : String(v));
  const hasNotes = rows.some((r) => r.note);
  const dense = rows.length > 8;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div>
          <h2 className="text-[17px] font-bold">{title}</h2>
          {hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
        </div>
        <ul className="flex gap-4 text-[13px] text-muted" aria-hidden>
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-[3px] ${s.swatch}`} /> {s.name}
            </li>
          ))}
        </ul>
      </div>
      {hasNotes && !dense ? (
        <div className="hidden sm:flex" aria-hidden>
          {rows.map((r) => (
            <span
              key={r.key}
              className={`num flex-1 text-center text-xs font-semibold ${r.note?.tone === "negative" ? "text-danger" : "text-success"}`}
            >
              {r.note?.text}
            </span>
          ))}
        </div>
      ) : null}
      <div className={`${heightClass} w-full`} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows.map((r) => ({ ...r.values, label: r.label, row: r }))}
            barGap={2}
            barCategoryGap="24%"
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              interval={dense ? "preserveStartEnd" : 0}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={(props) => {
                const row = (props.payload?.[0]?.payload as { row?: GroupedRow } | undefined)?.row;
                if (!props.active || !row) return null;
                return (
                  <div className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text shadow-sm">
                    <p className="mb-1 font-semibold">{row.fullLabel}</p>
                    {series.map((s) => (
                      <p key={s.key} className="flex items-center gap-2">
                        <span className={`size-2.5 rounded-[3px] ${s.swatch}`} aria-hidden />
                        {s.name}
                        <span className="num ml-auto pl-3 font-semibold">
                          {format(row.values[s.key] ?? 0)}
                        </span>
                      </p>
                    ))}
                    {row.note ? <p className="num mt-1 text-muted">{row.note.text}</p> : null}
                  </div>
                );
              }}
            />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{labelHeader}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.fullLabel}</th>
              {series.map((s) => (
                <td key={s.key}>{format(r.values[s.key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
