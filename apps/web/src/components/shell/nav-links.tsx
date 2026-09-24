"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Database } from "@gymnode/db";
import { cn } from "@/lib/utils";
import { BOTTOM_KEYS, HOME_ICON, isActive, navFor, NAV_ITEMS } from "./nav";

type GymRole = Database["public"]["Enums"]["gym_role"];

/** Full nav list with labels (desktop sidebar and the mobile "more" sheet). */
export function SidebarNav({ role, onNavigate }: { role: GymRole; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {navFor(role).map(({ key, href, icon: Icon }) => {
        const active = href !== null && isActive(pathname, href);
        const content = (
          <>
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="flex-1 truncate">{t(key)}</span>
            {href === null ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                {t("comingSoon")}
              </span>
            ) : null}
          </>
        );
        const base = "flex h-11 items-center gap-3 rounded-sm px-3 text-sm";
        return (
          <li key={key}>
            {href ? (
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  base,
                  active
                    ? "bg-accent font-semibold text-on-accent"
                    : "text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                {content}
              </Link>
            ) : (
              <span aria-disabled="true" className={cn(base, "cursor-default text-muted/70")}>
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Tablet icon rail (768–1199px): icons only, labels for screen readers and tooltips. */
export function RailNav({ role }: { role: GymRole }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className="flex flex-col items-center gap-1.5">
      {navFor(role).map(({ key, href, icon: Icon }) => {
        const active = href !== null && isActive(pathname, href);
        const label = href ? t(key) : `${t(key)} · ${t("comingSoon")}`;
        const base = "flex size-11 items-center justify-center rounded-sm";
        return (
          <li key={key}>
            {href ? (
              <Link
                href={href}
                aria-label={label}
                title={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  base,
                  active
                    ? "bg-accent text-on-accent"
                    : "text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </Link>
            ) : (
              <span
                aria-label={label}
                title={label}
                aria-disabled="true"
                className={cn(base, "text-muted/50")}
              >
                <Icon className="size-5" aria-hidden />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Mobile bottom bar (<768px): 4 items + "more" (DESIGN_SYSTEM §6 Bottom nav). */
export function BottomNav({ role, moreButton }: { role: GymRole; moreButton: React.ReactNode }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = BOTTOM_KEYS.map((k) => NAV_ITEMS.find((i) => i.key === k)).filter(
    (i): i is (typeof NAV_ITEMS)[number] => !!i && i.roles.includes(role),
  );
  return (
    <ul className="grid grid-cols-5">
      {items.map(({ key, href, icon }) => {
        const Icon = key === "dashboard" ? HOME_ICON : icon;
        const active = href !== null && isActive(pathname, href);
        const label =
          key === "dashboard" ? t("home") : key === "access" ? t("accessShort") : t(key);
        const cls = cn(
          "flex h-14 flex-col items-center justify-center gap-1 text-[11px]",
          active ? "font-semibold text-accent-text" : "text-muted",
        );
        return (
          <li key={key}>
            {href ? (
              <Link href={href} aria-current={active ? "page" : undefined} className={cls}>
                <Icon className="size-[22px]" aria-hidden />
                {label}
              </Link>
            ) : (
              <span aria-disabled="true" title={t("comingSoon")} className={cn(cls, "opacity-60")}>
                <Icon className="size-[22px]" aria-hidden />
                {label}
              </span>
            )}
          </li>
        );
      })}
      <li className="col-start-5">{moreButton}</li>
    </ul>
  );
}
