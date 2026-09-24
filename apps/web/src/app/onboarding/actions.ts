"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  gymSchema,
  packagesSchema,
  takaToPaisa,
  type GymInput,
  type PackageInput,
} from "@gymnode/core";
import { ACTIVE_GYM_COOKIE } from "@/lib/auth";
import { errorCode, fieldErrorsFrom, type ActionResult } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function createGym(input: GymInput): Promise<ActionResult> {
  const parsed = gymSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const g = parsed.data;

  const supabase = await createClient();
  const { data: gymId, error } = await supabase.rpc("create_gym_with_owner", {
    p_name: g.name,
    p_code_prefix: g.codePrefix,
    p_city: g.city,
    // The generated type says string, but the function accepts null (no phone given).
    p_phone: g.phone as string,
    p_address: g.address,
    p_branch_name: g.branchName,
    p_branch_address: g.branchAddress,
  });
  if (error || !gymId) return { ok: false, formError: errorCode(error) };

  (await cookies()).set(ACTIVE_GYM_COOKIE, gymId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/onboarding?step=logo");
}

export async function saveLogoPath(gymId: string, path: string): Promise<ActionResult> {
  if (!path.startsWith(`${gymId}/`)) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gyms")
    .update({ logo_path: path })
    .eq("id", gymId)
    .select("id");
  if (error || !data?.length)
    return {
      ok: false,
      formError: errorCode(error) === "unknown" ? "forbidden" : errorCode(error),
    };
  return { ok: true };
}

export async function savePackages(gymId: string, packages: PackageInput[]): Promise<ActionResult> {
  const parsed = packagesSchema.safeParse({ packages });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("packages").insert(
    parsed.data.packages.map((p, i) => ({
      gym_id: gymId,
      name: p.name,
      duration_days: p.durationDays,
      price_paisa: takaToPaisa(p.priceTaka),
      admission_fee_paisa: takaToPaisa(p.admissionFeeTaka),
      sort_order: i + 1,
    })),
  );
  if (error) return { ok: false, formError: errorCode(error) };
  redirect("/onboarding?step=staff");
}

export async function completeOnboarding(gymId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gyms")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", gymId)
    .select("id");
  if (error || !data?.length)
    return {
      ok: false,
      formError: errorCode(error) === "unknown" ? "forbidden" : errorCode(error),
    };
  revalidatePath("/app", "layout");
  redirect("/app");
}
