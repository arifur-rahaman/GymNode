import "server-only";
import {
  REPORT_PRESETS,
  reportRange,
  todayInDhaka,
  type ReportPreset,
  type ReportRange,
} from "@gymnode/core";
import { createClient } from "@/lib/supabase/server";

export type ReportSummary = {
  income_paisa: number;
  sales_paisa: number;
  expense_paisa: number;
  prev_income_paisa: number;
  prev_expense_paisa: number;
  methods: Record<string, number>;
  monthly: {
    month: string;
    income: number;
    expense: number;
    new_members: number;
    lost_members: number;
  }[];
  expense_categories: { name: string; is_salary: boolean; total: number }[];
  packages: { name: string; count: number; total: number }[];
  products: { name: string; qty: number; total: number }[];
  peak_hours: { hour: number; count: number }[];
  checkins: number;
  new_members: number;
  ended_memberships: number;
  renewed_memberships: number;
};

/** Reads ?range=…&from=…&to=… (default: 6 months, as highlighted in Reports.dc.html). */
export function parseRange(sp: Record<string, string | string[] | undefined>): {
  preset: ReportPreset;
  range: ReportRange;
  invalid: boolean;
} {
  const today = todayInDhaka();
  const preset: ReportPreset = REPORT_PRESETS.includes(sp.range as ReportPreset)
    ? (sp.range as ReportPreset)
    : "6m";
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const range = reportRange(preset, today, { from: str(sp.from), to: str(sp.to) });
  if (range) return { preset, range, invalid: false };
  return { preset, range: reportRange("month", today)!, invalid: true };
}

export async function loadReport(gymId: string, range: ReportRange) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_summary", {
    p_gym_id: gymId,
    p_from: range.from,
    p_to: range.to,
    p_prev_from: range.prevFrom,
    p_prev_to: range.prevTo,
  });
  if (error || !data) return null;
  return data as unknown as ReportSummary;
}

/** "6–8 AM", "10 AM–12 PM" for a 2-hour slot starting at `hour` (0–22). */
export function hourSlot(hour: number) {
  const part = (h: number) => ({ n: h % 12 === 0 ? 12 : h % 12, ap: h % 24 < 12 ? "AM" : "PM" });
  const a = part(hour);
  const b = part(hour + 2);
  return a.ap === b.ap ? `${a.n}–${b.n} ${b.ap}` : `${a.n} ${a.ap}–${b.n} ${b.ap}`;
}
