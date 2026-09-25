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

/** Midnight at the start of a Dhaka calendar day, as a real instant (Dhaka is UTC+6, no DST). */
export function dhakaDayStart(date: IsoDate): Date {
  if (!isIsoDate(date)) throw new RangeError(`Invalid date: ${date}`);
  return new Date(`${date}T00:00:00+06:00`);
}

export type Period = "today" | "week" | "month";

export interface PeriodRange {
  from: Date;
  to: Date;
  /** The same-length period just before, for "+12% vs yesterday" comparisons. */
  prevFrom: Date;
  prevTo: Date;
  firstDay: IsoDate;
}

/**
 * Today / this week (Saturday–Friday, as in Bangladesh) / this month, in Dhaka time.
 * `to` is exclusive and is the end of the current period, not "now".
 */
export function dhakaPeriod(period: Period, now: Date = new Date()): PeriodRange {
  const today = todayInDhaka(now);
  if (period === "today") {
    const firstDay = today;
    return {
      from: dhakaDayStart(firstDay),
      to: dhakaDayStart(addDays(firstDay, 1)),
      prevFrom: dhakaDayStart(addDays(firstDay, -1)),
      prevTo: dhakaDayStart(firstDay),
      firstDay,
    };
  }
  if (period === "week") {
    // getUTCDay of the calendar date: 0 = Sunday … 6 = Saturday.
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const sinceSaturday = (weekday + 1) % 7;
    const firstDay = addDays(today, -sinceSaturday);
    return {
      from: dhakaDayStart(firstDay),
      to: dhakaDayStart(addDays(firstDay, 7)),
      prevFrom: dhakaDayStart(addDays(firstDay, -7)),
      prevTo: dhakaDayStart(firstDay),
      firstDay,
    };
  }
  const [y, m] = today.split("-").map(Number) as [number, number];
  const firstDay = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const prev = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
  return {
    from: dhakaDayStart(firstDay),
    to: dhakaDayStart(next),
    prevFrom: dhakaDayStart(prev),
    prevTo: dhakaDayStart(firstDay),
    firstDay,
  };
}

/** Percentage change, rounded; null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

const MONTHS: Record<Locale, { long: string[]; short: string[] }> = {
  bn: {
    long: [
      "জানুয়ারি",
      "ফেব্রুয়ারি",
      "মার্চ",
      "এপ্রিল",
      "মে",
      "জুন",
      "জুলাই",
      "আগস্ট",
      "সেপ্টেম্বর",
      "অক্টোবর",
      "নভেম্বর",
      "ডিসেম্বর",
    ],
    // Reports.dc.html axis labels.
    short: [
      "জানু",
      "ফেব্রু",
      "মার্চ",
      "এপ্রি",
      "মে",
      "জুন",
      "জুলা",
      "আগ",
      "সেপ্ট",
      "অক্টো",
      "নভে",
      "ডিসে",
    ],
  },
  en: {
    long: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    short: MONTHS_SHORT,
  },
};

/** Month name for a date, English digits for the year: "সেপ্টেম্বর 2026", "Sep". */
export function formatMonth(
  date: IsoDate,
  locale: Locale,
  { style = "long", withYear = true }: { style?: "long" | "short"; withYear?: boolean } = {},
): string {
  if (!isIsoDate(date)) throw new RangeError(`Invalid date: ${date}`);
  const name = MONTHS[locale][style][Number(date.slice(5, 7)) - 1];
  return withYear ? `${name} ${date.slice(0, 4)}` : name!;
}
