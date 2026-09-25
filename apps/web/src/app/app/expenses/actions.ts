"use server";

import { revalidatePath } from "next/cache";
import {
  expenseCategorySchema,
  expenseSchema,
  takaToPaisa,
  type ExpenseCategoryInput,
  type ExpenseInput,
} from "@gymnode/core";
import { errorCode, fieldErrorsFrom, type ActionResult } from "@/lib/forms";
import { MANAGEMENT, defaultBranchId, requireGym } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";

function refresh() {
  revalidatePath("/app/expenses");
  revalidatePath("/app/reports");
  revalidatePath("/app");
}

/** Add or edit an expense. Salary categories are owner-only (enforced by the database). */
export async function saveExpense(
  expenseId: string | null,
  input: ExpenseInput,
): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const membership = await requireGym();
  if (!MANAGEMENT.includes(membership.role)) return { ok: false, formError: "forbidden" };
  const values = {
    category_id: parsed.data.categoryId,
    amount_paisa: takaToPaisa(parsed.data.amountTaka),
    spent_on: parsed.data.spentOn,
    note: parsed.data.note,
  };
  const supabase = await createClient();
  let result;
  if (expenseId) {
    result = await supabase
      .from("expenses")
      .update(values)
      .eq("id", expenseId)
      .is("deleted_at", null)
      .select("id");
  } else {
    const branchId = await defaultBranchId(membership);
    if (!branchId) return { ok: false, formError: "forbidden" };
    result = await supabase
      .from("expenses")
      .insert({ ...values, gym_id: membership.gymId, branch_id: branchId })
      .select("id");
  }
  if (result.error || !result.data?.length)
    return { ok: false, formError: result.error ? errorCode(result.error) : "forbidden" };
  refresh();
  return { ok: true };
}

/** Expenses are soft-deleted (kept for the audit log), never removed. */
export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", expenseId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data?.length)
    return { ok: false, formError: error ? errorCode(error) : "forbidden" };
  refresh();
  return { ok: true };
}

export async function saveCategory(
  categoryId: string | null,
  input: ExpenseCategoryInput,
): Promise<ActionResult> {
  const parsed = expenseCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const membership = await requireGym();
  const supabase = await createClient();
  const values = { name: parsed.data.name, is_salary: parsed.data.isSalary };
  const { data, error } = categoryId
    ? await supabase.from("expense_categories").update(values).eq("id", categoryId).select("id")
    : await supabase
        .from("expense_categories")
        .insert({ ...values, gym_id: membership.gymId, sort_order: 100 })
        .select("id");
  if (error?.code === "23505") return { ok: false, fieldErrors: { name: "categoryExists" } };
  if (error || !data?.length)
    return { ok: false, formError: error ? errorCode(error) : "forbidden" };
  refresh();
  return { ok: true };
}

/** Categories are hidden, not deleted, so old expenses keep their category. */
export async function setCategoryActive(
  categoryId: string,
  active: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .update({ is_active: active })
    .eq("id", categoryId)
    .select("id");
  if (error || !data?.length)
    return { ok: false, formError: error ? errorCode(error) : "forbidden" };
  refresh();
  return { ok: true };
}
