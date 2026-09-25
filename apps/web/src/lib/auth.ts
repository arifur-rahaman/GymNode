import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Database } from "@gymnode/db";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_GYM_COOKIE = "gn_gym";
export const ACTIVE_BRANCH_COOKIE = "gn_branch";
/** Gym a GymNode team member is viewing in read-only support mode (set by startSupport). */
export const SUPPORT_GYM_COOKIE = "gn_support";

type GymRole = Database["public"]["Enums"]["gym_role"];
type GymStatus = Database["public"]["Enums"]["gym_status"];

export type Membership = {
  gymUserId: string;
  gymId: string;
  role: GymRole;
  branchIds: string[] | null;
  gym: {
    id: string;
    name: string;
    codePrefix: string;
    logoPath: string | null;
    trialEndsAt: string | null;
    onboardingCompletedAt: string | null;
  };
  /** Set when a platform admin views this gym in support mode (read-only; the database enforces it). */
  support?: { sessionId: string; expiresAt: string };
};

/** Logged-in user id from the verified JWT, or null. Cached per request. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
});

export async function requireUserId(next?: string): Promise<string> {
  const id = await getUserId();
  if (!id) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return id;
}

export const getProfile = cache(async () => {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, locale, theme, last_gym_id, must_change_password")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
});

type PlatformRole = Database["public"]["Enums"]["platform_role"];

/** "super_admin" | "support" for GymNode team members, else null. */
export const getPlatformRole = cache(async (): Promise<PlatformRole | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_admins")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
});

export const isPlatformAdmin = cache(async (): Promise<boolean> => !!(await getPlatformRole()));

/** Every active gym membership of the current user (RLS limits this to their own rows). */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("gym_users")
    .select(
      "id, gym_id, role, branch_ids, gyms!inner(id, name, code_prefix, logo_path, trial_ends_at, onboarding_completed_at)",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at");
  return (data ?? []).map((row) => ({
    gymUserId: row.id,
    gymId: row.gym_id,
    role: row.role,
    branchIds: row.branch_ids,
    gym: {
      id: row.gyms.id,
      name: row.gyms.name,
      codePrefix: row.gyms.code_prefix,
      logoPath: row.gyms.logo_path,
      trialEndsAt: row.gyms.trial_ends_at,
      onboardingCompletedAt: row.gyms.onboarding_completed_at,
    },
  }));
});

/**
 * Support mode: a platform admin with an active support session for the gym in the cookie.
 * They see the panel as an owner would, but RLS allows reads only.
 */
export const getSupportMembership = cache(async (): Promise<Membership | null> => {
  const gymId = (await cookies()).get(SUPPORT_GYM_COOKIE)?.value;
  if (!gymId || !(await isPlatformAdmin())) return null;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("support_sessions")
    .select("id, expires_at")
    .eq("gym_id", gymId)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) return null;
  const { data: gym } = await supabase
    .from("gyms")
    .select("id, name, code_prefix, logo_path, trial_ends_at, onboarding_completed_at")
    .eq("id", gymId)
    .maybeSingle();
  if (!gym) return null;
  return {
    gymUserId: "",
    gymId: gym.id,
    role: "owner",
    branchIds: null,
    gym: {
      id: gym.id,
      name: gym.name,
      codePrefix: gym.code_prefix,
      logoPath: gym.logo_path,
      trialEndsAt: gym.trial_ends_at,
      onboardingCompletedAt: gym.onboarding_completed_at,
    },
    support: { sessionId: session.id, expiresAt: session.expires_at },
  };
});

/** The gym the user is working in: support mode → cookie choice → last used → first membership. */
export const getActiveMembership = cache(async (): Promise<Membership | null> => {
  const support = await getSupportMembership();
  if (support) return support;
  const memberships = await getMemberships();
  if (memberships.length === 0) return null;
  const cookieGym = (await cookies()).get(ACTIVE_GYM_COOKIE)?.value;
  const profile = await getProfile();
  return (
    memberships.find((m) => m.gymId === cookieGym) ??
    memberships.find((m) => m.gymId === profile?.last_gym_id) ??
    memberships[0] ??
    null
  );
});

export async function getGymAccessState(gymId: string): Promise<GymStatus | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("gym_access_state", { p_gym_id: gymId });
  return data ?? null;
}

/** Where a logged-in user belongs right now. */
export async function homePathForUser(): Promise<string> {
  const profile = await getProfile();
  if (profile?.must_change_password) return "/account/password";
  const membership = await getActiveMembership();
  if (membership) {
    if (membership.role === "owner" && !membership.gym.onboardingCompletedAt) return "/onboarding";
    return "/app";
  }
  if (await isPlatformAdmin()) return "/admin";
  return "/onboarding";
}
