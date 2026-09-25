import { addDays, daysBetween, isIsoDate, type IsoDate } from "./dates";

/** Report period buttons from Reports.dc.html: this month, 3 months, 6 months, custom. */
export const REPORT_PRESETS = ["month", "3m", "6m", "custom"] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

export interface ReportRange {
  from: IsoDate;
  to: IsoDate;
  /** The period before, for "+14% vs the previous 6 months". */
  prevFrom: IsoDate;
  prevTo: IsoDate;
}

/** Longest custom range (the database refuses more than this). */
export const MAX_REPORT_DAYS = 800;

function monthStart(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

/** Shifts a date by whole months, keeping the day but clamping to the month's end (31 Mar − 1 month → 28/29 Feb). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + months;
  const d = Number(date.slice(8, 10));
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

/**
 * Date range for a report. Month presets run from the 1st of the month up to today and are
 * compared with the same stretch of the months before (1–25 Sep vs 1–25 Aug). A custom range
 * is compared with the same number of days just before it. Returns null for a bad custom range.
 */
export function reportRange(
  preset: ReportPreset,
  today: IsoDate,
  custom?: { from?: string | null; to?: string | null },
): ReportRange | null {
  if (preset === "custom") {
    const from = custom?.from ?? "";
    const to = custom?.to ?? "";
    if (!isIsoDate(from) || !isIsoDate(to) || to < from) return null;
    const span = daysBetween(from, to);
    if (span > MAX_REPORT_DAYS) return null;
    return { from, to, prevFrom: addDays(from, -(span + 1)), prevTo: addDays(from, -1) };
  }
  const months = preset === "month" ? 1 : preset === "3m" ? 3 : 6;
  const from = addMonths(monthStart(today), -(months - 1));
  const prevFrom = addMonths(from, -months);
  const shifted = addMonths(today, -months);
  const prevTo = shifted < from ? shifted : addDays(from, -1);
  return { from, to: today, prevFrom, prevTo };
}
