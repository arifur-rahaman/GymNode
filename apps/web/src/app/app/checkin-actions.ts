"use server";

import { revalidatePath } from "next/cache";
import { errorCode, type ActionResult } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export type CheckInResult = { result: "allowed" | "blocked"; reason: string | null };

/** Reception checks a member in by hand (door devices arrive in M8). */
export async function checkInMember(
  memberId: string,
  override = false,
): Promise<ActionResult<CheckInResult>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in_member", {
    p_member_id: memberId,
    p_override: override,
  });
  if (error || !data) return { ok: false, formError: errorCode(error) };
  revalidatePath(`/app/members/${memberId}`);
  const r = data as { result: "allowed" | "blocked"; reason: string | null };
  return { ok: true, data: { result: r.result, reason: r.reason } };
}
