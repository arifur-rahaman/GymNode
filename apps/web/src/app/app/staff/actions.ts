"use server";

import { revalidatePath } from "next/cache";
import {
  staffLoginEmail,
  staffPasswordResetSchema,
  staffSchema,
  type StaffInput,
} from "@gymnode/core";
import { errorCode, fieldErrorsFrom, type ActionResult } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Creates a staff login (phone + first password) and links it to the gym.
 * Order matters: permission is checked with the caller's own session BEFORE the
 * admin API is touched, and the new login is removed again if linking fails.
 */
export async function createStaff(
  gymId: string,
  input: StaffInput,
): Promise<ActionResult<{ name: string }>> {
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const { fullName, phone, role, password } = parsed.data;

  const supabase = await createClient();
  const { data: allowed, error: checkError } = await supabase.rpc("can_manage_staff_role", {
    p_gym_id: gymId,
    p_role: role,
  });
  if (checkError) return { ok: false, formError: errorCode(checkError) };
  if (!allowed) return { ok: false, formError: "forbidden" };

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: staffLoginEmail(phone),
    password,
    email_confirm: true,
    app_metadata: { created_for_gym: gymId },
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    const code = errorCode(createError);
    return code === "emailTaken"
      ? { ok: false, fieldErrors: { phone: "phoneTaken" } }
      : { ok: false, formError: code };
  }

  const { error: linkError } = await supabase.rpc("add_gym_user", {
    p_gym_id: gymId,
    p_user_id: created.user.id,
    p_role: role,
    p_display_name: fullName,
    p_phone: phone,
  });
  if (linkError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, formError: errorCode(linkError) };
  }

  revalidatePath("/app/staff");
  revalidatePath("/onboarding");
  return { ok: true, data: { name: fullName } };
}

export async function setStaffActive(gymUserId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_gym_user_active", {
    p_gym_user_id: gymUserId,
    p_active: active,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  revalidatePath("/app/staff");
  return { ok: true };
}

export async function resetStaffPassword(
  gymUserId: string,
  input: { password: string },
): Promise<ActionResult> {
  const parsed = staffPasswordResetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data: userId, error } = await supabase.rpc("staff_user_for_reset", {
    p_gym_user_id: gymUserId,
  });
  if (error || !userId)
    return {
      ok: false,
      formError: errorCode(error) === "unknown" ? "forbidden" : errorCode(error),
    };

  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: parsed.data.password,
  });
  if (updateError) return { ok: false, formError: errorCode(updateError) };

  await supabase.rpc("mark_staff_password_reset", { p_gym_user_id: gymUserId });
  revalidatePath("/app/staff");
  return { ok: true };
}
