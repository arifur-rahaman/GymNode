/**
 * Bangladeshi mobile numbers. Stored in E.164 form (+8801XXXXXXXXX).
 * Valid operator prefixes are 013–019 (01X where X is 3–9).
 */

const BD_MOBILE = /^(?:\+?88)?(01[3-9]\d{8})$/;

/** Accepts "01712345678", "8801712345678", "+880 1712-345678" etc. Returns null if invalid. */
export function normalizeBdPhone(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, "");
  const match = BD_MOBILE.exec(compact);
  return match ? `+88${match[1]}` : null;
}

export function isValidBdPhone(input: string): boolean {
  return normalizeBdPhone(input) !== null;
}

/** Local display form: "01712345678". */
export function toLocalBdPhone(e164: string): string {
  const normalized = normalizeBdPhone(e164);
  return normalized ? normalized.slice(3) : e164;
}

/** Masked for people who should not see full numbers, as in the designs: "017•• •••421". */
export function maskBdPhone(input: string): string {
  const local = toLocalBdPhone(input);
  if (local.length !== 11) return "•••";
  return `${local.slice(0, 3)}•• •••${local.slice(-3)}`;
}
