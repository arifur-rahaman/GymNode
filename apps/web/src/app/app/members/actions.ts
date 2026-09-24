"use server";

import { revalidatePath } from "next/cache";
import {
  freezeSchema,
  memberSchema,
  paymentSchema,
  takaToPaisa,
  type FreezeInput,
  type MemberInput,
  type PaymentInput,
} from "@gymnode/core";
import { errorCode, fieldErrorsFrom, type ActionResult } from "@/lib/forms";
import { defaultBranchId, requireGym } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";

type PaymentMethod = "cash" | "bkash" | "nagad" | "rocket" | "card";

function fail(error: { code?: string; message?: string } | null): { ok: false; formError: string } {
  return { ok: false, formError: errorCode(error) };
}

/** New member (+ optional first package and payment) in one database transaction. */
export async function createMember(
  member: MemberInput,
  payment: PaymentInput | null,
): Promise<ActionResult<{ id: string; code: string }>> {
  const m = memberSchema.safeParse(member);
  const p = payment ? paymentSchema.safeParse(payment) : null;
  if (!m.success || (p && !p.success)) {
    return {
      ok: false,
      fieldErrors: {
        ...(m.success ? {} : fieldErrorsFrom(m.error)),
        ...(p && !p.success
          ? Object.fromEntries(
              Object.entries(fieldErrorsFrom(p.error)).map(([k, v]) => [`payment.${k}`, v]),
            )
          : {}),
      },
    };
  }

  const membership = await requireGym();
  const branchId = await defaultBranchId(membership);
  if (!branchId) return { ok: false, formError: "forbidden" };

  const supabase = await createClient();
  const pay = p?.success ? p.data : null;
  const { data, error } = await supabase.rpc("register_member", {
    p_gym_id: membership.gymId,
    p_branch_id: branchId,
    p_full_name: m.data.fullName,
    p_phone: m.data.phone,
    // Generated types mark optional SQL arguments as non-null; null is accepted at runtime.
    p_gender: m.data.gender as "male",
    p_dob: m.data.dob as string,
    p_address: m.data.address,
    p_emergency_name: m.data.emergencyName,
    p_emergency_phone: m.data.emergencyPhone as string,
    p_trainer_id: m.data.trainerId as string,
    p_notes: m.data.notes,
    p_package_id: (pay?.packageId ?? null) as string,
    p_amount_paisa: pay ? takaToPaisa(pay.amountTaka) : 0,
    p_discount_paisa: pay ? takaToPaisa(pay.discountTaka) : 0,
    p_method: (pay?.method ?? "cash") as PaymentMethod,
    p_transaction_id: (pay?.transactionId || null) as string,
  });
  if (error || !data) return fail(error);

  const result = data as { member_id: string; member_code: string };
  revalidatePath("/app/members");
  return { ok: true, data: { id: result.member_id, code: result.member_code } };
}

export async function updateMember(memberId: string, member: MemberInput): Promise<ActionResult> {
  const m = memberSchema.safeParse(member);
  if (!m.success) return { ok: false, fieldErrors: fieldErrorsFrom(m.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .update({
      full_name: m.data.fullName,
      phone: m.data.phone,
      gender: m.data.gender,
      dob: m.data.dob,
      address: m.data.address,
      emergency_contact_name: m.data.emergencyName,
      emergency_contact_phone: m.data.emergencyPhone,
      assigned_trainer_id: m.data.trainerId,
      notes: m.data.notes,
    })
    .eq("id", memberId)
    .select("id");
  if (error || !data?.length) return error ? fail(error) : { ok: false, formError: "forbidden" };
  revalidatePath(`/app/members/${memberId}`);
  revalidatePath("/app/members");
  return { ok: true };
}

export async function saveMemberPhoto(memberId: string, path: string): Promise<ActionResult> {
  const membership = await requireGym();
  if (!path.startsWith(`${membership.gymId}/${memberId}/`))
    return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .update({ photo_path: path })
    .eq("id", memberId)
    .select("id");
  if (error || !data?.length) return error ? fail(error) : { ok: false, formError: "forbidden" };
  revalidatePath(`/app/members/${memberId}`);
  revalidatePath("/app/members");
  return { ok: true };
}

export async function renewMembership(
  memberId: string,
  payment: PaymentInput,
): Promise<ActionResult<{ endDate: string }>> {
  const p = paymentSchema.safeParse(payment);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_payment_and_renew", {
    p_member_id: memberId,
    p_package_id: p.data.packageId,
    p_amount_paisa: takaToPaisa(p.data.amountTaka),
    p_discount_paisa: takaToPaisa(p.data.discountTaka),
    p_method: p.data.method,
    p_transaction_id: (p.data.transactionId || null) as string,
  });
  if (error || !data) return fail(error);
  revalidatePath(`/app/members/${memberId}`);
  revalidatePath("/app/members");
  return { ok: true, data: { endDate: (data as { end_date: string }).end_date } };
}

export async function freezeMembership(
  memberId: string,
  membershipId: string,
  input: FreezeInput,
): Promise<ActionResult> {
  const f = freezeSchema.safeParse(input);
  if (!f.success) return { ok: false, fieldErrors: fieldErrorsFrom(f.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("freeze_membership", {
    p_membership_id: membershipId,
    p_from: f.data.from,
    p_until: f.data.until,
    p_reason: f.data.reason,
  });
  if (error) return fail(error);
  revalidatePath(`/app/members/${memberId}`);
  revalidatePath("/app/members");
  return { ok: true };
}

export async function unfreezeMembership(
  memberId: string,
  membershipId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unfreeze_membership", { p_membership_id: membershipId });
  if (error) return fail(error);
  revalidatePath(`/app/members/${memberId}`);
  revalidatePath("/app/members");
  return { ok: true };
}

export async function deleteMember(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", memberId)
    .select("id");
  if (error || !data?.length) return error ? fail(error) : { ok: false, formError: "forbidden" };
  revalidatePath("/app/members");
  return { ok: true };
}

/** QR sign-ups: approve (gets a member code) or reject (removed, it has no history). */
export async function approveMember(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .update({ status: "active" })
    .eq("id", memberId)
    .eq("status", "pending")
    .select("id");
  if (error || !data?.length) return error ? fail(error) : { ok: false, formError: "forbidden" };
  revalidatePath("/app/members");
  return { ok: true };
}

export async function rejectMember(memberId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .delete()
    .eq("id", memberId)
    .eq("status", "pending")
    .select("id");
  if (error || !data?.length) return error ? fail(error) : { ok: false, formError: "forbidden" };
  revalidatePath("/app/members");
  return { ok: true };
}
