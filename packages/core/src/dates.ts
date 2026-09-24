/**
 * Date helpers. Timestamps are stored in UTC; everything shown to people and every
 * "today" decision uses Asia/Dhaka. Calendar dates (membership start/end) are plain
 * "YYYY-MM-DD" strings, never Date objects, so they cannot shift by timezone.
 */

export const DHAKA_TZ = "Asia/Dhaka";

/** A calendar date in "YYYY-MM-DD" form. */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Today's calendar date in Dhaka (not UTC). At 02:00 Dhaka time, UTC is still "yesterday". */
export function todayInDhaka(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtcMidnight(date: IsoDate): number {
  if (!isIsoDate(date)) throw new RangeError(`Invalid date: ${date}`);
  return Date.parse(`${date}T00:00:00Z`);
}

const DAY_MS = 86_400_000;

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(toUtcMidnight(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive if `to` is later). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS);
}

export type Locale = "bn" | "en";

const intlLocale: Record<Locale, string> = { bn: "bn-BD", en: "en-GB" };

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Table-style date, always English digits as in the designs: "24 Sep 2026".
 * Built by hand because Intl output differs between ICU versions ("Sep" vs "Sept").
 */
export function formatDateShort(value: Date | IsoDate): string {
  const iso = typeof value === "string" ? value : todayInDhaka(value);
  if (!isIsoDate(iso)) throw new RangeError(`Invalid date: ${iso}`);
  const [year, month, day] = iso.split("-");
  return `${day} ${MONTHS_SHORT[Number(month) - 1]} ${year}`;
}

/** Friendly long date in the user's language: "বৃহস্পতিবার, ২৪ সেপ্টেম্বর" / "Thursday, 24 September". */
export function formatDateLong(value: Date | IsoDate, locale: Locale): string {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  return new Intl.DateTimeFormat(intlLocale[locale], {
    timeZone: typeof value === "string" ? "UTC" : DHAKA_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/** Clock time in Dhaka, e.g. "9:14". */
export function formatTimeDhaka(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DHAKA_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}
