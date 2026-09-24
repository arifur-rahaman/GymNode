import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { THEME_COOKIE, parseTheme } from "@/lib/preferences";

// Temporary start page for M0. Replaced by login / role-based redirect in M1.
export default async function HomePage() {
  const t = await getTranslations();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-5 py-10">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-md bg-accent text-lg font-bold text-on-accent"
        >
          G
        </span>
        <span className="text-xl font-bold">{t("app.name")}</span>
      </div>
      <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("home.title")}</h1>
      <p className="text-muted">{t("home.body")}</p>
      <div className="flex flex-wrap items-center gap-3">
        {process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_UI === "true" ? (
          <Button asChild>
            <Link href="/dev/ui">{t("home.devUi")}</Link>
          </Button>
        ) : null}
        <LocaleSwitcher />
        <ThemeToggle initialTheme={theme} />
      </div>
    </main>
  );
}
