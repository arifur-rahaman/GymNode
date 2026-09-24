/**
 * Money helpers. All amounts in the database are integer paisa (৳1 = 100 paisa)
 * so there are never floating-point rounding errors. See docs/PLAN.md §4.1.
 */

export type Paisa = number;

const TAKA = "৳";

/** Converts a taka amount typed by a user (e.g. 1500 or 1500.5) to integer paisa. */
export function takaToPaisa(taka: number): Paisa {
  if (!Number.isFinite(taka)) throw new RangeError("Amount must be a finite number");
  return Math.round(taka * 100);
}

export function paisaToTaka(paisa: Paisa): number {
  return paisa / 100;
}

/**
 * Groups digits the Bangladeshi/Indian way: last three digits, then pairs.
 * 342000 → "3,42,000", 12345678 → "1,23,45,678".
 * Done by hand (not Intl "en-IN") so output is identical on every phone browser.
 */
export function groupLakh(integerDigits: string): string {
  if (integerDigits.length <= 3) return integerDigits;
  const last3 = integerDigits.slice(-3);
  let rest = integerDigits.slice(0, -3);
  const pairs: string[] = [];
  while (rest.length > 2) {
    pairs.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) pairs.unshift(rest);
  return `${pairs.join(",")},${last3}`;
}

/**
 * Formats paisa as taka with lakh grouping and English digits (per DESIGN_SYSTEM §3).
 * Whole-taka amounts show no decimals: 150000 → "৳1,500"; 150050 → "৳1,500.50".
 */
export function formatTaka(paisa: Paisa): string {
  if (!Number.isInteger(paisa)) throw new RangeError("Paisa must be an integer");
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  const decimals = fraction === 0 ? "" : `.${String(fraction).padStart(2, "0")}`;
  return `${sign}${TAKA}${groupLakh(String(whole))}${decimals}`;
}

const LAKH_PAISA = 100_000 * 100;
const CRORE_PAISA = 10_000_000 * 100;

function trimFixed(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Short form for small screens and KPI tiles: "৳3.42L", "৳1.2Cr".
 * Amounts under one lakh use the full format ("৳46,800").
 */
export function formatTakaCompact(paisa: Paisa): string {
  const abs = Math.abs(paisa);
  const sign = paisa < 0 ? "-" : "";
  if (abs >= CRORE_PAISA) return `${sign}${TAKA}${trimFixed(abs / CRORE_PAISA)}Cr`;
  if (abs >= LAKH_PAISA) return `${sign}${TAKA}${trimFixed(abs / LAKH_PAISA)}L`;
  return formatTaka(Math.round(paisa / 100) * 100);
}
