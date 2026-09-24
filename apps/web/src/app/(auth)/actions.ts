"use server";

import { redirect } from "next/navigation";
import {
  emailOnlySchema,
  isStaffLoginEmail,
  loginIdentifierToEmail,
  loginSchema,
  newPasswordSchema,
  signUpSchema,
  type LoginInput,
  type NewPasswordInput,
  type SignUpInput,
} from "@gymnode/core";
import { applyProfilePreferences } from "@/app/actions/preferences";
import { getProfile, homePathForUser } from "@/lib/auth";
import { errorCode, fieldErrorsFrom, type ActionResult } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath, siteUrl } from "@/lib/urls";

export async function signIn(input: LoginInput, next?: string | null): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: loginIdentifierToEmail(parsed.data.identifier),
    password: parsed.data.password,
  });
  if (error) return { ok: false, formError: errorCode(error) };

  await applyProfilePreferences(await getProfile());
  const home = await homePathForUser();
  // A forced password change always comes first.
  redirect(home === "/account/password" ? home : (safeNextPath(next) ?? home));
}

export async function signUp(input: SignUpInput): Promise<ActionResult<{ email: string }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { ok: false, formError: errorCode(error) };
  // With email confirmation on, Supabase hides existing accounts by returning a user with no identities.
  if (data.user && data.user.identities?.length === 0)
    return { ok: false, formError: "emailTaken" };
  // Email confirmation off (local development): already logged in.
  if (data.session) redirect("/onboarding");
  return { ok: true, data: { email: parsed.data.email } };
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = emailOnlySchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  // Staff logins have no real mailbox; their owner/manager resets them instead.
  if (!isStaffLoginEmail(parsed.data.email)) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${await siteUrl()}/auth/callback?next=/account/password`,
    });
  }
  // Same answer whether or not the email exists, so accounts can't be discovered this way.
  return { ok: true };
}

export async function setNewPassword(input: NewPasswordInput): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, formError: errorCode(error) };
  await supabase.rpc("clear_password_change_flag");
  redirect(await homePathForUser());
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
