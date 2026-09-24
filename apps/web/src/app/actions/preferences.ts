"use server";

import { cookies } from "next/headers";
import { getUserId } from "@/lib/auth";
import {
  LOCALE_COOKIE,
  PREFERENCE_COOKIE_MAX_AGE,
  THEME_COOKIE,
  parseLocale,
  parseTheme,
  type Locale,
  type Theme,
} from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

const cookieOptions = {
  path: "/",
  maxAge: PREFERENCE_COOKIE_MAX_AGE,
  sameSite: "lax" as const,
  httpOnly: false,
};

/** Saves to the cookie (instant, first paint) and, when logged in, to the profile (all devices). */
async function saveToProfile(values: { locale?: Locale; theme?: Theme }) {
  const userId = await getUserId().catch(() => null);
  if (!userId) return;
  const supabase = await createClient();
  await supabase.from("profiles").update(values).eq("user_id", userId);
}

export async function setLocale(value: string) {
  const locale = parseLocale(value);
  (await cookies()).set(LOCALE_COOKIE, locale, cookieOptions);
  await saveToProfile({ locale });
}

export async function setTheme(value: string) {
  const theme = parseTheme(value);
  (await cookies()).set(THEME_COOKIE, theme, cookieOptions);
  await saveToProfile({ theme });
}

/** After login: bring the user's saved language/theme to this device. */
export async function applyProfilePreferences(profile: { locale: string; theme: string } | null) {
  if (!profile) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, parseLocale(profile.locale), cookieOptions);
  store.set(THEME_COOKIE, parseTheme(profile.theme), cookieOptions);
}
