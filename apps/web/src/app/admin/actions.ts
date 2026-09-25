"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  extendTrialSchema,
  gymPlanSchema,
  gymStatusSchema,
  invoicePaidSchema,
  invoiceSchema,
  planSchema,
  platformSettingsSchema,
  supportSessionSchema,
  takaToPaisa,
  teamMemberSchema,
  ticketReplySchema,
  type ExtendTrialInput,
  type GymPlanInput,
  type GymStatusInput,
  type InvoiceInput,
  type InvoicePaidInput,
  type PlanInput,
  type PlatformSettingsInput,
  type SupportSessionInput,
  type TeamMemberInput,
  type TicketReplyInput,
} from "@gymnode/core";
import { SUPPORT_GYM_COOKIE, getPlatformRole } from "@/lib/auth";
import { errorCode, fieldErrorsFrom, type ActionResult } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/** Every admin action re-checks in the database too; this only gives a clean error early. */
async function requireTeam(superOnly = false) {
  const role = await getPlatformRole();
  return !!role && (!superOnly || role === "super_admin");
}

function refreshGym(gymId?: string) {
  revalidatePath("/admin", "layout");
  if (gymId) revalidatePath(`/admin/gyms/${gymId}`);
}

export async function setGymPlan(gymId: string, input: GymPlanInput): Promise<ActionResult> {
  const p = gymPlanSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  if (!(await requireTeam(true))) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_gym_plan", {
    p_gym_id: gymId,
    p_plan_id: (p.data.planId || null) as string,
    p_price_paisa: (p.data.priceTaka === null ? null : takaToPaisa(p.data.priceTaka)) as number,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  refreshGym(gymId);
  return { ok: true };
}

export async function setGymStatus(gymId: string, input: GymStatusInput): Promise<ActionResult> {
  const p = gymStatusSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  if (!(await requireTeam(true))) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_gym_status", {
    p_gym_id: gymId,
    p_status: p.data.status,
    p_reason: p.data.reason,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  refreshGym(gymId);
  return { ok: true };
}

export async function extendTrial(gymId: string, input: ExtendTrialInput): Promise<ActionResult> {
  const p = extendTrialSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  if (!(await requireTeam(true))) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_extend_trial", {
    p_gym_id: gymId,
    p_days: p.data.days,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  refreshGym(gymId);
  return { ok: true };
}

export async function createInvoice(gymId: string, input: InvoiceInput): Promise<ActionResult> {
  const p = invoiceSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  if (!(await requireTeam(true))) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_invoice", {
    p_gym_id: gymId,
    p_amount_paisa: takaToPaisa(p.data.amountTaka),
    p_due_date: p.data.dueDate,
    p_period_start: p.data.periodMonth as string,
    p_note: p.data.note,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  refreshGym(gymId);
  return { ok: true };
}

export async function generateInvoices(month: string): Promise<ActionResult<{ count: number }>> {
  if (!(await requireTeam(true))) return { ok: false, formError: "forbidden" };
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, formError: "invalidDate" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_generate_invoices", { p_month: `${month}-01` });
  if (error) return { ok: false, formError: errorCode(error) };
  refreshGym();
  return { ok: true, data: { count: Number(data ?? 0) } };
}

export async function markInvoicePaid(
  invoiceId: string,
  input: InvoicePaidInput,
): Promise<ActionResult> {
  const p = invoicePaidSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  if (!(await requireTeam(true))) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_mark_invoice_paid", {
    p_invoice_id: invoiceId,
    p_method: p.data.method,
    p_transaction_id: (p.data.transactionId || null) as string,
    p_paid_on: p.data.paidOn,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  refreshGym();
  return { ok: true };
}

export async function voidInvoice(
  invoiceId: string,
  input: { reason: string },
): Promise<ActionResult> {
  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, fieldErrors: { reason: "tooShort" } };
  if (!(await requireTeam(true))) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_void_invoice", {
    p_invoice_id: invoiceId,
    p_reason: reason,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  refreshGym();
  return { ok: true };
}

export async function savePlan(planId: string | null, input: PlanInput): Promise<ActionResult> {
  const p = planSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  if (!(await requireTeam(true))) return { ok: false, formError: "forbidden" };
  const values = {
    name: p.data.name,
    name_en: p.data.nameEn,
    price_paisa: p.data.priceTaka === null ? null : takaToPaisa(p.data.priceTaka),
    billing_period: p.data.billingPeriod,
    max_members: p.data.maxMembers,
    max_branches: p.data.maxBranches,
    max_devices: p.data.maxDevices,
    features: Object.fromEntries(p.data.features.map((f) => [f, true])),
    is_active: p.data.isActive,
  };
  const supabase = await createClient();
  const { data, error } = planId
    ? await supabase.from("plans").update(values).eq("id", planId).select("id")
    : await supabase
        .from("plans")
        .insert({
          ...values,
          code: `${
            p.data.nameEn
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "plan"
          }-${Date.now().toString(36)}`,
          sort_order: 50,
        })
        .select("id");
  if (error || !data?.length)
    return { ok: false, formError: error ? errorCode(error) : "forbidden" };
  revalidatePath("/admin/plans");
  return { ok: true };
}

/** Opens a gym's panel read-only for up to 2 hours. The reason is stored in the audit log. */
export async function startSupport(
  gymId: string,
  input: SupportSessionInput,
): Promise<ActionResult> {
  const p = supportSessionSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  if (!(await requireTeam())) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_support_session", {
    p_gym_id: gymId,
    p_reason: p.data.reason,
    p_minutes: p.data.minutes,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  (await cookies()).set(SUPPORT_GYM_COOKIE, gymId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: p.data.minutes * 60,
  });
  redirect("/app");
}

export async function endSupport(sessionId: string, gymId: string) {
  const supabase = await createClient();
  await supabase.rpc("end_support_session", { p_session_id: sessionId });
  (await cookies()).delete(SUPPORT_GYM_COOKIE);
  redirect(`/admin/gyms/${gymId}`);
}

export async function replyTicket(
  ticketId: string,
  input: TicketReplyInput,
): Promise<ActionResult> {
  const p = ticketReplySchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_support_ticket", {
    p_ticket_id: ticketId,
    p_body: p.data.body,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  revalidatePath("/admin/support", "layout");
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function setTicketStatus(
  ticketId: string,
  status: "open" | "answered" | "closed",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_ticket_status", {
    p_ticket_id: ticketId,
    p_status: status,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  revalidatePath("/admin/support", "layout");
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function addTeamMember(input: TeamMemberInput): Promise<ActionResult> {
  const p = teamMemberSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  if (!(await requireTeam(true))) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_team_member", {
    p_email: p.data.email,
    p_role: p.data.role,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function removeTeamMember(userId: string): Promise<ActionResult> {
  if (!(await requireTeam(true))) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_team_member", { p_user_id: userId });
  if (error) return { ok: false, formError: errorCode(error) };
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function saveSettings(input: PlatformSettingsInput): Promise<ActionResult> {
  const p = platformSettingsSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  if (!(await requireTeam(true))) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  for (const [key, value] of [
    ["trial_days", p.data.trialDays],
    ["past_due_grace_days", p.data.graceDays],
  ] as const) {
    const { error } = await supabase.rpc("admin_update_setting", { p_key: key, p_value: value });
    if (error) return { ok: false, formError: errorCode(error) };
  }
  revalidatePath("/admin/settings");
  return { ok: true };
}
