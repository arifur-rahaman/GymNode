"use client";

import { useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { setTheme } from "@/app/actions/preferences";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/preferences";

/** Switches dark/light instantly, then saves the choice in a cookie. */
function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const t = useTranslations("prefs");
  const [, startTransition] = useTransition();

  function toggle() {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const next: Theme = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    startTransition(() => setTheme(next));
  }

  // The icon/label is rendered for both states and CSS shows the right one, so it
  // stays correct even before React hydrates.
  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={toggle}
      data-testid="theme-toggle"
      data-initial-theme={initialTheme}
      className="group"
    >
      <Sun className="hidden in-data-[theme=dark]:block" aria-hidden />
      <Moon className="hidden in-data-[theme=light]:block" aria-hidden />
      <span className="sr-only in-data-[theme=light]:hidden">{t("switchToLight")}</span>
      <span className="sr-only hidden in-data-[theme=light]:inline">{t("switchToDark")}</span>
    </Button>
  );
}

export { ThemeToggle };
