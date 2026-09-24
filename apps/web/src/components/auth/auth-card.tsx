import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_COOKIE, parseTheme } from "@/lib/preferences";

/** Centered card used by login, sign-up, password and onboarding pages. */
export async function AuthCard({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = await getTranslations("app");
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-4 md:px-8">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-sm bg-accent font-bold text-on-accent"
          >
            G
          </span>
          <span className="text-lg font-bold">{t("name")}</span>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle initialTheme={theme} />
        </div>
      </header>
      <main
        id="main"
        className={`mx-auto flex w-full flex-1 flex-col justify-center px-4 pb-12 ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="rounded-xl border border-border bg-surface p-5 md:p-7">
          <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
