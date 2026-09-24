import "server-only";
import { redirect } from "next/navigation";
import type { Database } from "@gymnode/db";
import { getActiveMembership, type Membership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type GymRole = Database["public"]["Enums"]["gym_role"];

export const FRONT_DESK: GymRole[] = ["owner", "manager", "reception"];
export const MANAGEMENT: GymRole[] = ["owner", "manager"];

/** Active gym membership for pages under /app (the layout already guarantees one exists). */
export async function requireGym(): Promise<Membership> {
  const membership = await getActiveMembership();
  if (!membership) redirect("/onboarding");
  return membership;
}

export function hasRole(membership: Membership, roles: GymRole[]) {
  return roles.includes(membership.role);
}

/** Branch new records go to: the staff member's first allowed branch, else the gym's first branch. */
export async function defaultBranchId(membership: Membership): Promise<string | null> {
  const supabase = await createClient();
  let query = supabase
    .from("branches")
    .select("id")
    .eq("gym_id", membership.gymId)
    .eq("is_active", true);
  if (membership.branchIds?.length) query = query.in("id", membership.branchIds);
  const { data } = await query.order("created_at").limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function gymPackages(gymId: string, { activeOnly = true } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("packages")
    .select("id, name, duration_days, price_paisa, admission_fee_paisa, is_active, sort_order")
    .eq("gym_id", gymId)
    .is("deleted_at", null);
  if (activeOnly) query = query.eq("is_active", true);
  const { data } = await query.order("sort_order").order("created_at");
  return data ?? [];
}

export async function gymTrainers(gymId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gym_users")
    .select("id, display_name")
    .eq("gym_id", gymId)
    .eq("role", "trainer")
    .eq("is_active", true)
    .order("display_name");
  return data ?? [];
}

/** Short-lived links for private member photos (never public URLs). */
export async function signedPhotoUrls(paths: (string | null | undefined)[], expiresIn = 60 * 30) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("member-photos").createSignedUrls(unique, expiresIn);
  return new Map(
    (data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]),
  );
}
