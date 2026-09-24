"use server";

import { selfRegistrationSchema, type SelfRegistrationInput } from "@gymnode/core";
import { errorCode, fieldErrorsFrom, type ActionResult } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/** Public QR sign-up: creates a pending member for reception to approve. No login needed. */
export async function submitSelfRegistration(
  slug: string,
  input: SelfRegistrationInput,
): Promise<ActionResult> {
  const parsed = selfRegistrationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_self_registration", {
    p_slug: slug,
    p_full_name: d.fullName,
    p_phone: d.phone,
    // Optional SQL arguments: generated types say non-null, null is accepted.
    p_gender: d.gender as "male",
    p_dob: d.dob as string,
    p_address: d.address,
    p_emergency_name: d.emergencyName,
    p_emergency_phone: d.emergencyPhone as string,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  return { ok: true };
}
