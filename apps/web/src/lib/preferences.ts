/**
 * Language and theme preferences. Stored in cookies so the server renders the right
 * language/theme on the first paint (no flash). From M1 they are also saved to
 * profiles.locale / profiles.theme so they follow the user across devices.
 */

export const LOCALES = ["bn", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "bn";
export const LOCALE_COOKIE = "gn_locale";

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "dark";
export const THEME_COOKIE = "gn_theme";

export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseLocale(value: string | undefined | null): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

export function parseTheme(value: string | undefined | null): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}
