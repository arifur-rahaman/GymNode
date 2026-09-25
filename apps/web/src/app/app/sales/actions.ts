"use server";

import { revalidatePath } from "next/cache";
import {
  productSchema,
  saleSchema,
  stockAdjustSchema,
  stockInSchema,
  takaToPaisa,
  type ProductInput,
  type SaleInput,
  type StockAdjustInput,
  type StockInInput,
} from "@gymnode/core";
import { errorCode, fieldErrorsFrom, type ActionResult } from "@/lib/forms";
import { FRONT_DESK, MANAGEMENT, requireGym } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";

export type SaleDone = { invoiceNo: string; receiptToken: string; totalPaisa: number };

function refresh() {
  revalidatePath("/app/sales");
  revalidatePath("/app", "layout");
}

export async function saveProduct(
  productId: string | null,
  input: ProductInput,
): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const membership = await requireGym();
  if (!MANAGEMENT.includes(membership.role)) return { ok: false, formError: "forbidden" };
  const values = {
    name: parsed.data.name,
    price_paisa: takaToPaisa(parsed.data.priceTaka),
    low_stock_at: parsed.data.lowStockAt,
    is_active: parsed.data.isActive,
  };
  const supabase = await createClient();
  const { data, error } = productId
    ? await supabase.from("products").update(values).eq("id", productId).select("id")
    : await supabase
        .from("products")
        .insert({ ...values, gym_id: membership.gymId, sort_order: 100 })
        .select("id");
  if (error?.code === "23505") return { ok: false, fieldErrors: { name: "productExists" } };
  if (error || !data?.length)
    return { ok: false, formError: error ? errorCode(error) : "forbidden" };
  refresh();
  return { ok: true };
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", productId)
    .select("id");
  if (error || !data?.length)
    return { ok: false, formError: error ? errorCode(error) : "forbidden" };
  refresh();
  return { ok: true };
}

export async function addStock(productId: string, input: StockInInput): Promise<ActionResult> {
  const parsed = stockInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const { qty, unitCostTaka, recordExpense, categoryId, note } = parsed.data;
  const unitCost = unitCostTaka > 0 ? takaToPaisa(unitCostTaka) : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_stock", {
    p_product_id: productId,
    p_qty: qty,
    p_unit_cost_paisa: unitCost as number,
    p_expense_category_id: (recordExpense && unitCost && categoryId ? categoryId : null) as string,
    p_note: note,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  refresh();
  revalidatePath("/app/expenses");
  return { ok: true };
}

export async function adjustStock(
  productId: string,
  input: StockAdjustInput,
): Promise<ActionResult> {
  const parsed = stockAdjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_new_qty: parsed.data.newQty,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, formError: errorCode(error) };
  refresh();
  return { ok: true };
}

/** POS checkout: stock, sale and payment are recorded together by the database (record_sale). */
export async function recordSale(input: SaleInput): Promise<ActionResult<SaleDone>> {
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const membership = await requireGym();
  if (!FRONT_DESK.includes(membership.role)) return { ok: false, formError: "forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_sale", {
    p_gym_id: membership.gymId,
    p_items: parsed.data.items.map((i) => ({ product_id: i.productId, qty: i.qty })),
    p_member_id: parsed.data.memberId as string,
    p_discount_paisa: takaToPaisa(parsed.data.discountTaka),
    p_method: parsed.data.method,
    p_transaction_id: (parsed.data.transactionId || null) as string,
  });
  if (error || !data) return { ok: false, formError: errorCode(error) };
  const result = data as { payment_id: string; invoice_no: string; total_paisa: number };
  const { data: pay } = await supabase
    .from("payments")
    .select("receipt_token")
    .eq("id", result.payment_id)
    .single();
  refresh();
  revalidatePath("/app/payments");
  return {
    ok: true,
    data: {
      invoiceNo: result.invoice_no,
      receiptToken: pay?.receipt_token ?? "",
      totalPaisa: Number(result.total_paisa),
    },
  };
}
