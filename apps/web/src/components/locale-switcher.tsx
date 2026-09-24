"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/app/actions/preferences";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/preferences";

const LABELS: Record<Locale, string> = { bn: "বাংলা", en: "English" };

/** বাংলা / English switch. Saves a cookie and re-renders the page in the new language. */
function LocaleSwitcher() {
  const t = useTranslations("prefs");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn(
        "inline-flex gap-1 rounded-md border border-border bg-surface p-1",
        pending && "opacity-70",
      )}
    >
      {(Object.keys(LABELS) as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          onClick={() => choose(l)}
          className="h-9 min-w-11 cursor-pointer rounded-[9px] px-3 text-sm text-muted aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-on-accent"
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}

export { LocaleSwitcher };
