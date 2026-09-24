import type { z } from "zod";

/**
 * What every Server Action returns to a form. Error values are translation codes
 * (see messages/*.json "errors"), never raw database or library messages.
 */
export type ActionResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; formError?: string; fieldErrors?: Record<string, string> };

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Maps Supabase Auth / Postgres errors to our translation codes. */
export function errorCode(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "unknown";
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || message.includes("invalid login credentials"))
    return "invalidLogin";
  if (code === "email_not_confirmed") return "emailNotConfirmed";
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already been registered")
  )
    return "emailTaken";
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    message.includes("rate limit")
  )
    return "rateLimited";
  if (code === "weak_password") return "weakPassword";
  if (code === "same_password") return "samePassword";
  if (code === "otp_expired" || code === "flow_state_expired") return "linkExpired";
  if (message.includes("too_many_gyms")) return "tooManyGyms";
  if (code === "42501" || message.includes("forbidden") || message.includes("row-level security"))
    return "forbidden";
  if (message.includes("fetch failed") || message.includes("network")) return "network";
  return "unknown";
}
