"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCheck,
  CreditCard,
  Building2,
  LayoutGrid,
  LifeBuoy,
  Layers,
  MessageCircle,
  Settings,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Item = {
  key: string;
  href: string | null;
  icon: LucideIcon;
  milestone?: string;
  superOnly?: boolean;
};

// Order and labels from SASidebar.dc.html.
export const ADMIN_NAV: Item[] = [
  { key: "dashboard", href: "/admin", icon: LayoutGrid },
  { key: "gyms", href: "/admin/gyms", icon: Building2 },
  { key: "billing", href: "/admin/billing", icon: CreditCard },
  { key: "plans", href: "/admin/plans", icon: Layers },
  { key: "devices", href: null, icon: Smartphone, milestone: "M8" },
  { key: "messages", href: null, icon: MessageCircle, milestone: "M6" },
  { key: "support", href: "/admin/support", icon: LifeBuoy },
  { key: "onboarding", href: null, icon: CheckCheck, milestone: "later" },
  { key: "team", href: "/admin/team", icon: Users },
  { key: "settings", href: "/admin/settings", icon: Settings, superOnly: true },
];

export function AdminNav({
  isSuper,
  badges = {},
  onNavigate,
}: {
  isSuper: boolean;
  badges?: Record<string, number>;
  onNavigate?: () => void;
}) {
  const t = useTranslations("adminNav");
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {ADMIN_NAV.filter((i) => isSuper || !i.superOnly).map(({ key, href, icon: Icon }) => {
        const active =
          href !== null && (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
        const content = (
          <>
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="flex-1 truncate">{t(key)}</span>
            {href === null ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                {t("comingSoon")}
              </span>
            ) : badges[key] ? (
              <span className="num rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-bg">
                {badges[key]}
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
