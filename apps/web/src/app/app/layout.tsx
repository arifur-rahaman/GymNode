import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { daysBetween, todayInDhaka } from "@gymnode/core";
import { AppShell } from "@/components/shell/app-shell";
import {
  getActiveMembership,
  getGymAccessState,
  getMemberships,
  getProfile,
  isPlatformAdmin,
  requireUserId,
} from "@/lib/auth";
import { THEME_COOKIE, parseTheme } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

/** Gym panel frame. Everything under /app needs a logged-in staff member of an onboarded gym. */
export default async function GymPanelLayout({ children }: LayoutProps<"/app">) {
  await requireUserId("/app");
  const profile = await getProfile();
  if (profile?.must_change_password) redirect("/account/password");

  const membership = await getActiveMembership();
  if (!membership) redirect((await isPlatformAdmin()) ? "/admin" : "/onboarding");
  if (membership.role === "owner" && !membership.gym.onboardingCompletedAt) redirect("/onboarding");

  const [memberships, accessState] = await Promise.all([
    getMemberships(),
    getGymAccessState(membership.gymId),
  ]);

  // Branch shown under the gym name: the only branch, or the staff member's first branch.
  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("gym_id", membership.gymId)
    .eq("is_active", true)
    .order("created_at");
  const branchName =
    branches && branches.length === 1 ? branches[0]!.name : (branches?.[0]?.name ?? null);

  let daysLeft: number | null = null;
  if (membership.gym.trialEndsAt) {
    const trialEnd = todayInDhaka(new Date(membership.gym.trialEndsAt));
    const left = daysBetween(todayInDhaka(), trialEnd);
    // past_due: days until read-only (trial end + 7 grace days).
    daysLeft = accessState === "past_due" ? left + 7 : left;
  }

  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <AppShell
      role={membership.role}
      gym={{ id: membership.gymId, name: membership.gym.name, logoPath: membership.gym.logoPath }}
      branchName={branchName}
      gyms={memberships.map((m) => ({ id: m.gymId, name: m.gym.name }))}
      userName={profile?.full_name || ""}
      accessState={accessState}
      daysLeft={daysLeft}
      theme={theme}
    >
      {children}
    </AppShell>
  );
}
