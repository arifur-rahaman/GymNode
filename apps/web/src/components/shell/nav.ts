import {
  BarChart3,
  Box,
  Dumbbell,
  Globe,
  Home,
  LayoutGrid,
  Lock,
  MessageCircle,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { Database } from "@gymnode/db";

type GymRole = Database["public"]["Enums"]["gym_role"];

export type NavItem = {
  key: string;
  /** null = not built yet; shown with a "coming soon" tag (PLAN.md Q9). */
  href: string | null;
  icon: LucideIcon;
  roles: GymRole[];
  milestone?: string;
};

const ALL: GymRole[] = ["owner", "manager", "reception", "trainer"];
const DESK: GymRole[] = ["owner", "manager", "reception"];
const MGMT: GymRole[] = ["owner", "manager"];

// Order and labels from Sidebar.dc.html.
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/app", icon: LayoutGrid, roles: ALL },
  { key: "members", href: "/app/members", icon: Users, roles: ALL },
  { key: "payments", href: "/app/payments", icon: WalletCards, roles: DESK },
  { key: "packages", href: "/app/packages", icon: Box, roles: DESK },
  { key: "access", href: null, icon: Lock, roles: DESK, milestone: "M8" },
  { key: "staff", href: "/app/staff", icon: Dumbbell, roles: MGMT },
  { key: "sales", href: "/app/sales", icon: ShoppingBag, roles: DESK },
  { key: "accounts", href: "/app/expenses", icon: Wallet, roles: MGMT },
  { key: "reports", href: "/app/reports", icon: BarChart3, roles: MGMT },
  { key: "messages", href: null, icon: MessageCircle, roles: MGMT, milestone: "M6" },
  { key: "website", href: null, icon: Globe, roles: ["owner"], milestone: "later" },
  { key: "settings", href: "/app/settings", icon: Settings, roles: MGMT },
];

// Mobile bottom bar (Dashboard-Mobile.dc.html): 4 destinations + "more".
export const BOTTOM_KEYS = ["dashboard", "members", "payments", "access"] as const;
export const HOME_ICON = Home;

export function navFor(role: GymRole) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function isActive(pathname: string, href: string) {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`);
}
