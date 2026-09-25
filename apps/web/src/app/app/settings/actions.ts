"use server";

import { revalidatePath } from "next/cache";
import {
  gymProfileSchema,
  takaToPaisa,
  ticketSchema,
  type GymProfileInput,
  type TicketInput,
} from "@gymnode/core";
import { errorCode, fieldErrorsFrom, type ActionResult } from "@/lib/forms";
import { MANAGEMENT, requireGym } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";

/** Owner edits the gym's name, contact details and the dashboard's monthly income target. */
export async function saveGymProfile(input: GymProfileInput): Promise<ActionResult> {
  const p = gymProfileSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  const membership = await requireGym();
  if (membership.role !== "owner" || membership.support)
    return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { data: gym } = await supabase
    .from("gyms")
    .select("settings")
    .eq("id", membership.gymId)
    .single();
  const settings = { ...((gym?.settings ?? {}) as Record<string, unknown>) };
  if (p.data.monthlyTargetTaka === null) delete settings.monthly_target_paisa;
  else settings.monthly_target_paisa = takaToPaisa(p.data.monthlyTargetTaka);
  const { data, error } = await supabase
    .from("gyms")
    .update({
      name: p.data.name,
      city: p.data.city,
      phone: p.data.phone,
      address: p.data.address,
      settings: settings as never,
    })
    .eq("id", membership.gymId)
    .select("id");
  if (error || !data?.length)
    return { ok: false, formError: error ? errorCode(error) : "forbidden" };
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function openTicket(input: TicketInput): Promise<ActionResult<{ id: string }>> {
  const p = ticketSchema.safeParse(input);
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  const membership = await requireGym();
  if (!MANAGEMENT.includes(membership.role) || membership.support)
    return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_support_ticket", {
    p_gym_id: membership.gymId,
    p_subject: p.data.subject,
    p_body: p.data.body,
    p_priority: p.data.priority,
  });
  if (error || !data) return { ok: false, formError: errorCode(error) };
  revalidatePath("/app/settings");
  return { ok: true, data: { id: data as string } };
}
