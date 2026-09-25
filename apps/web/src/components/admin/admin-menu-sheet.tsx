"use client";

import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/(auth)/actions";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Theme } from "@/lib/preferences";
import { AdminNav } from "./admin-nav";

export function AdminMenuSheet({
  isSuper,
  badges,
  theme,
}: {
  isSuper: boolean;
  badges: Record<string, number>;
  theme: Theme;
}) {
  const ts = useTranslations("shell");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const t = useTranslations("adminNav");
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={ts("menu")}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
        <SheetTitle>{t("brand")}</SheetTitle>
        <nav aria-label={ts("menu")} className="mt-4 flex-1">
          <AdminNav isSuper={isSuper} badges={badges} onNavigate={() => setOpen(false)} />
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
