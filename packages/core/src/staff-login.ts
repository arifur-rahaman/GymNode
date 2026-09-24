import { normalizeBdPhone } from "./phone";

/**
 * Staff log in with their phone number + password (founder decision Q1/Q2).
 * Supabase only allows phone logins when a paid SMS provider is configured, so each
 * staff login is stored under an internal, never-emailed address derived from the phone.
 * `.invalid` is a reserved top-level domain (RFC 2606): mail to it can never be delivered.
 */
export const STAFF_LOGIN_DOMAIN = "staff.gymnode.invalid";

export function staffLoginEmail(phone: string): string {
  const e164 = normalizeBdPhone(phone);
  if (!e164) throw new RangeError("Invalid Bangladeshi mobile number");
  return `${e164.slice(1)}@${STAFF_LOGIN_DOMAIN}`;
}

export function isStaffLoginEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${STAFF_LOGIN_DOMAIN}`);
}

/** The login box accepts an email (owners) or a phone number (staff). */
export function loginIdentifierToEmail(identifier: string): string {
  const trimmed = identifier.trim();
  const phone = normalizeBdPhone(trimmed);
  return phone ? staffLoginEmail(phone) : trimmed.toLowerCase();
}
