import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_COOKIE, parseTheme } from "@/lib/preferences";
import { Gallery } from "./gallery";

export const metadata: Metadata = { title: "UI", robots: { index: false } };

/** Internal component gallery (brief §3). Hidden in production unless ENABLE_DEV_UI=true. */
export default async function DevUiPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_UI !== "true") notFound();
  const t = await getTranslations("devUi");
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <main className="flex flex-col gap-6 px-4 py-6 md:px-8 md:py-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle initialTheme={theme} />
        </div>
      </header>
      <div className="grid gap-6 xl:grid-cols-2">
        {(["dark", "light"] as const).map((panelTheme) => (
          <div
            key={panelTheme}
            data-theme={panelTheme}
            data-testid={`gallery-${panelTheme}`}
            style={{ colorScheme: panelTheme }}
            className="min-w-0 rounded-xl border border-border bg-bg p-4 text-text md:p-6"
          >
            <p className="mb-4 text-xs font-semibold tracking-wide text-muted uppercase">
              {panelTheme}
            </p>
            <Gallery idPrefix={panelTheme} />
          </div>
        ))}
      </div>
    </main>
  );
}
