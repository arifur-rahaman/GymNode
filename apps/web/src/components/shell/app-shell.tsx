import type { ReactNode } from "react";
import Link from "next/link";
import { LifeBuoy, LogOut, TriangleAlert } from "lucide-react";
import { endSupport } from "@/app/admin/actions";
import { getTranslations } from "next-intl/server";
import { formatTimeDhaka } from "@gymnode/core";
import type { Database } from "@gymnode/db";
import { signOut } from "@/app/(auth)/actions";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/preferences";
import { GymLogo } from "./gym-logo";
import { GymSwitcher } from "./gym-switcher";
import { MoreSheet } from "./more-sheet";
import { BottomNav, RailNav, SidebarNav } from "./nav-links";

type GymRole = Database["public"]["Enums"]["gym_role"];
type GymStatus = Database["public"]["Enums"]["gym_status"];

export type ShellProps = {
  children: ReactNode;
  role: GymRole;
  gym: { id: string; name: string; logoPath: string | null };
  branchName: string | null;
  gyms: { id: string; name: string }[];
  userName: string;
  accessState: GymStatus | null;
  /** Days left in trial (trial) or before read-only (past_due). */
  daysLeft: number | null;
  theme: Theme;
  badges?: Record<string, number>;
  /** Support mode (platform admin viewing read-only). */
  support?: { sessionId: string; expiresAt: string } | null;
  /** Paying gym with an overdue subscription invoice. */
  billingOverdue?: boolean;
};

/**
 * Responsive app frame (DESIGN_SYSTEM §5):
 *  - desk ≥1200px: 248px sidebar with labels, gym/branch, trial card, user
 *  - md 768–1199px: 76px icon rail
 *  - <768px: top bar + bottom tab bar, full menu in a sheet
 */
export async function AppShell(props: ShellProps) {
  const {
    children,
    role,
    gym,
    branchName,
    gyms,
    userName,
    accessState,
    daysLeft,
    theme,
    badges,
    support,
    billingOverdue,
  } = props;
  const t = await getTranslations("shell");
  const tr = await getTranslations("roles");
  const ta = await getTranslations("auth");

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        {t("skipToContent")}
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-surface p-4 desk:flex print:!hidden">
        <div className="flex items-center gap-3 px-1">
          <GymLogo name={gym.name} logoPath={gym.logoPath} />
          <div className="min-w-0">
            <p className="truncate font-bold">{gym.name}</p>
            {branchName ? <p className="truncate text-[13px] text-muted">{branchName}</p> : null}
          </div>
        </div>
        <GymSwitcher gyms={gyms} activeGymId={gym.id} />
        <nav aria-label={t("menu")} className="flex-1">
          <SidebarNav role={role} badges={badges} />
        </nav>
        {accessState === "trial" && daysLeft !== null ? (
          <div className="rounded-md bg-surface-2 p-3.5">
            <p className="text-sm font-semibold">
              {t("trialDaysLeft", { days: String(daysLeft) })}
            </p>
            <span className="mt-1 block text-[13px] text-muted">
              <Link href="/app/settings?tab=plan" className="text-accent-text hover:underline">
                {t("seePlans")} →
              </Link>
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-bold"
          >
            {userName.charAt(0) || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="text-xs text-muted">{tr(role)}</p>
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

      {/* Tablet icon rail */}
      <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col items-center gap-4 overflow-y-auto border-r border-border bg-surface py-4 md:flex desk:hidden print:!hidden">
        <GymLogo name={gym.name} logoPath={gym.logoPath} />
        <nav aria-label={t("menu")} className="flex-1">
          <RailNav role={role} />
        </nav>
        <ThemeToggle initialTheme={theme} />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="icon" aria-label={ta("logout")}>
            <LogOut />
          </Button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface px-2 md:hidden print:hidden">
          <MoreSheet role={role} gymName={gym.name} theme={theme} variant="menu" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold">{gym.name}</p>
            {branchName ? <p className="truncate text-xs text-muted">{branchName}</p> : null}
          </div>
          <GymLogo name={gym.name} logoPath={gym.logoPath} className="size-9" />
        </header>

        {support ? (
          <div
            role="status"
            className="sticky top-14 z-20 flex flex-wrap items-center gap-2.5 border-b border-border bg-badge-blue-bg px-4 py-2.5 text-sm font-medium text-badge-blue-fg md:top-0 md:px-8 print:hidden"
          >
            <LifeBuoy className="size-[18px] shrink-0" aria-hidden />
            <span className="flex-1">
              {t("supportBanner", { time: formatTimeDhaka(new Date(support.expiresAt)) })}
            </span>
            <form action={endSupport.bind(null, support.sessionId, gym.id)}>
              <Button type="submit" size="sm" variant="secondary">
                {t("supportEnd")}
              </Button>
            </form>
          </div>
        ) : null}

        {accessState === "past_due" || accessState === "suspended" ? (
          <div
            role="status"
            className="flex items-start gap-2.5 border-b border-border bg-badge-amber-bg px-4 py-3 text-sm font-medium text-badge-amber-fg md:px-8"
          >
            <TriangleAlert className="mt-0.5 size-[18px] shrink-0" aria-hidden />
            <span>
              {accessState === "past_due"
                ? billingOverdue
                  ? t("billOverdueBanner")
                  : t("pastDueBanner", { days: String(Math.max(daysLeft ?? 0, 0)) })
                : t("suspendedBanner")}
            </span>
          </div>
        ) : null}

        <main
          id="main"
          className="flex-1 px-4 pt-5 pb-24 md:px-6 md:pt-6 md:pb-8 desk:px-8 desk:pt-7"
        >
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label={t("menu")}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
        >
          <BottomNav
            role={role}
            moreButton={<MoreSheet role={role} gymName={gym.name} theme={theme} variant="tab" />}
          />
        </nav>
      </div>
    </div>
  );
}
