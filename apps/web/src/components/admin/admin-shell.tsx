import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/(auth)/actions";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/preferences";
import { AdminMenuSheet } from "./admin-menu-sheet";
import { AdminNav } from "./admin-nav";

/** Super admin frame (SASidebar.dc.html): sidebar on desktop, top bar + menu sheet below 1200px. */
export async function AdminShell({
  children,
  userName,
  role,
  isSuper,
  badges,
  theme,
}: {
  children: ReactNode;
  userName: string;
  role: "super_admin" | "support";
  isSuper: boolean;
  badges: Record<string, number>;
  theme: Theme;
}) {
  const t = await getTranslations("adminNav");
  const ts = await getTranslations("shell");
  const ta = await getTranslations("auth");
  const brand = (
    <div className="flex items-center gap-3 px-1">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-lg font-bold text-on-accent"
      >
        G
      </span>
      <div className="min-w-0">
        <p className="truncate font-bold">{t("brand")}</p>
        <p className="text-[11px] font-semibold tracking-wider text-muted">SUPER ADMIN</p>
      </div>
    </div>
  );
  return (
    <div className="min-h-dvh desk:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        {ts("skipToContent")}
      </a>
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-surface p-4 desk:flex print:!hidden">
        {brand}
        <nav aria-label={ts("menu")} className="flex-1">
          <AdminNav isSuper={isSuper} badges={badges} />
        </nav>
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-bold"
          >
            {userName.charAt(0) || "A"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="text-xs text-muted">{t(`role_${role}`)}</p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon-sm" aria-label={ta("logout")}>
              <LogOut />
            </Button>
          </form>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle initialTheme={theme} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface px-2 desk:hidden print:hidden">
          <AdminMenuSheet isSuper={isSuper} badges={badges} theme={theme} />
          <p className="flex-1 truncate font-bold">{t("brand")} · Super Admin</p>
        </header>
        <main id="main" className="flex-1 px-4 pt-5 pb-10 md:px-6 md:pt-6 desk:px-8 desk:pt-7">
          {children}
        </main>
      </div>
    </div>
  );
}
