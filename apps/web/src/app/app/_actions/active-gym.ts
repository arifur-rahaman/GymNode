"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_GYM_COOKIE, getMemberships, getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Switch the gym the user is working in (only to gyms they belong to). */
export async function setActiveGym(gymId: string) {
  const memberships = await getMemberships();
  if (!memberships.some((m) => m.gymId === gymId)) return;
  (await cookies()).set(ACTIVE_GYM_COOKIE, gymId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  const userId = await getUserId();
  if (userId) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ last_gym_id: gymId }).eq("user_id", userId);
  }
  revalidatePath("/app", "layout");
}
