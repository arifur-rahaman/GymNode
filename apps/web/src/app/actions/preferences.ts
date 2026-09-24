"use server";

import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  PREFERENCE_COOKIE_MAX_AGE,
  THEME_COOKIE,
  parseLocale,
  parseTheme,
} from "@/lib/preferences";

const cookieOptions = {
  path: "/",
  maxAge: PREFERENCE_COOKIE_MAX_AGE,
  sameSite: "lax" as const,
  httpOnly: false,
};

// TODO(M1): also save to profiles.locale / profiles.theme for logged-in users.
export async function setLocale(value: string) {
  (await cookies()).set(LOCALE_COOKIE, parseLocale(value), cookieOptions);
}

export async function setTheme(value: string) {
  (await cookies()).set(THEME_COOKIE, parseTheme(value), cookieOptions);
}
