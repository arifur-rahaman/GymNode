"use client";

import { useState } from "react";
import { LogOut, Menu, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Database } from "@gymnode/db";
import { signOut } from "@/app/(auth)/actions";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Theme } from "@/lib/preferences";
import { SidebarNav } from "./nav-links";

type GymRole = Database["public"]["Enums"]["gym_role"];

/** Full menu on phones: opened from the top-bar menu button or the "more" tab. */
export function MoreSheet({
  role,
  gymName,
  theme,
  variant,
}: {
  role: GymRole;
  gymName: string;
  theme: Theme;
  variant: "menu" | "tab";
}) {
  const t = useTranslations("nav");
  const ts = useTranslations("shell");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {variant === "menu" ? (
          <Button variant="ghost" size="icon" aria-label={ts("menu")}>
            <Menu />
          </Button>
        ) : (
          <button
            type="button"
            className="flex h-14 w-full cursor-pointer flex-col items-center justify-center gap-1 text-[11px] text-muted"
          >
            <MoreHorizontal className="size-[22px]" aria-hidden />
            {t("more")}
          </button>
        )}
      </SheetTrigger>
      <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
        <SheetTitle>{gymName}</SheetTitle>
        <nav aria-label={ts("menu")} className="mt-4 flex-1">
          <SidebarNav role={role} onNavigate={() => setOpen(false)} />
        </nav>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <LocaleSwitcher />
          <ThemeToggle initialTheme={theme} />
          <form action={signOut} className="ml-auto">
            <Button type="submit" variant="secondary">
              <LogOut /> {ta("logout")}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
