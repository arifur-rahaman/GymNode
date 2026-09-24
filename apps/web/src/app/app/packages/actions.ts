"use server";

import { revalidatePath } from "next/cache";
import { packageFormSchema, takaToPaisa, type PackageFormInput } from "@gymnode/core";
import { errorCode, fieldErrorsFrom, type ActionResult } from "@/lib/forms";
import { requireGym } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";

/** Create or update a package. Price changes are audited by a database trigger. */
export async function savePackage(
  packageId: string | null,
  input: PackageFormInput,
): Promise<ActionResult> {
  const parsed = packageFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const membership = await requireGym();
  const values = {
    name: parsed.data.name,
    duration_days: parsed.data.durationDays,
    price_paisa: takaToPaisa(parsed.data.priceTaka),
    admission_fee_paisa: takaToPaisa(parsed.data.admissionFeeTaka),
    is_active: parsed.data.isActive,
  };
  const supabase = await createClient();
  const { data, error } = packageId
    ? await supabase.from("packages").update(values).eq("id", packageId).select("id")
    : await supabase
        .from("packages")
        .insert({ ...values, gym_id: membership.gymId, sort_order: 100 })
        .select("id");
  if (error || !data?.length)
    return { ok: false, formError: error ? errorCode(error) : "forbidden" };
  revalidatePath("/app/packages");
  return { ok: true };
}

export async function deletePackage(packageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("packages")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", packageId)
    .select("id");
  if (error || !data?.length)
    return { ok: false, formError: error ? errorCode(error) : "forbidden" };
  revalidatePath("/app/packages");
  return { ok: true };
}
