"use server";

import { revalidatePath } from "next/cache";
import {
  cancelPaymentSchema,
  dueSchema,
  paymentSchema,
  takaToPaisa,
  type DueInput,
  type PaymentInput,
} from "@gymnode/core";
import { errorCode, fieldErrorsFrom, type ActionResult } from "@/lib/forms";
import { FRONT_DESK, requireGym } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";

export type PaymentMember = {
  id: string;
  name: string;
  code: string | null;
  phone: string;
  status: string;
  duePaisa: number;
  endDate: string | null;
  packageId: string | null;
  hasMembership: boolean;
};

export type PaymentDone = { invoiceNo: string; receiptToken: string; endDate?: string };

function refresh(memberId?: string) {
  revalidatePath("/app/payments");
  revalidatePath("/app/members");
  if (memberId) revalidatePath(`/app/members/${memberId}`);
}

async function receiptFor(paymentId: string | null | undefined) {
  if (!paymentId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("invoice_no, receipt_token")
    .eq("id", paymentId)
    .single();
  return data;
}

/** Member search for the take-payment panel (RLS limits it to the caller's gym). */
export async function searchPaymentMembers(query: string): Promise<PaymentMember[]> {
  const membership = await requireGym();
  if (!FRONT_DESK.includes(membership.role)) return [];
  const q = query
    .replace(/[%_,()*\\]/g, " ")
    .trim()
    .slice(0, 60);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_overview")
    .select(
      "id, full_name, member_code, phone, display_status, due_paisa, end_date, package_id, membership_id",
    )
    .eq("gym_id", membership.gymId)
    .neq("status", "pending")
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,member_code.ilike.%${q}%`)
    .order("full_name")
    .limit(8);
  return (data ?? []).map((m) => ({
    id: m.id!,
    name: m.full_name!,
    code: m.member_code,
    phone: m.phone!,
    status: m.display_status ?? "expired",
    duePaisa: Number(m.due_paisa ?? 0),
    endDate: m.end_date,
    packageId: m.package_id,
    hasMembership: !!m.membership_id,
  }));
}

export async function takeRenewalPayment(
  memberId: string,
  input: PaymentInput,
): Promise<ActionResult<PaymentDone>> {
  const p = paymentSchema.safeParse(input);
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
  if (error || !data) return { ok: false, formError: errorCode(error) };
  const result = data as { payment_id: string | null; end_date: string };
  const receipt = await receiptFor(result.payment_id);
  refresh(memberId);
  return {
    ok: true,
    data: {
      invoiceNo: receipt?.invoice_no ?? "",
      receiptToken: receipt?.receipt_token ?? "",
      endDate: result.end_date,
    },
  };
}

export async function takeDuePayment(
  memberId: string,
  input: DueInput,
): Promise<ActionResult<PaymentDone>> {
  const d = dueSchema.safeParse(input);
  if (!d.success) return { ok: false, fieldErrors: fieldErrorsFrom(d.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pay_due", {
    p_member_id: memberId,
    p_amount_paisa: takaToPaisa(d.data.amountTaka),
    p_method: d.data.method,
    p_transaction_id: (d.data.transactionId || null) as string,
  });
  if (error || !data) return { ok: false, formError: errorCode(error) };
  const receipt = await receiptFor((data as { payment_id: string }).payment_id);
  refresh(memberId);
  return {
    ok: true,
    data: { invoiceNo: receipt?.invoice_no ?? "", receiptToken: receipt?.receipt_token ?? "" },
  };
}

export async function verifyPayment(paymentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("verify_payment", { p_payment_id: paymentId });
  if (error) return { ok: false, formError: errorCode(error) };
  refresh();
  return { ok: true };
}

export async function cancelPayment(
  paymentId: string,
  input: { reason: string },
): Promise<ActionResult> {
  const c = cancelPaymentSchema.safeParse(input);
  if (!c.success) return { ok: false, fieldErrors: fieldErrorsFrom(c.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_payment", {
    p_payment_id: paymentId,
    p_reason: c.data.reason,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  refresh();
  return { ok: true };
}
