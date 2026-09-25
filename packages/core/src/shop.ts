import type { Paisa } from "./money";

export interface CartLine {
  pricePaisa: Paisa;
  qty: number;
}

export interface CartTotals {
  subtotalPaisa: Paisa;
  discountPaisa: Paisa;
  totalPaisa: Paisa;
  items: number;
}

/** POS totals, the same way the database's record_sale adds them up. The discount can't make it free. */
export function cartTotals(lines: CartLine[], discountPaisa: Paisa = 0): CartTotals {
  const subtotalPaisa = lines.reduce((sum, l) => sum + l.pricePaisa * l.qty, 0);
  const discount = Math.min(Math.max(0, Math.round(discountPaisa)), Math.max(0, subtotalPaisa - 1));
  return {
    subtotalPaisa,
    discountPaisa: discount,
    totalPaisa: subtotalPaisa - discount,
    items: lines.reduce((n, l) => n + l.qty, 0),
  };
}

/** Stock state for the badge on a product: out (0), low (at or under the alert level) or ok. */
export function stockLevel(stockQty: number, lowStockAt: number): "out" | "low" | "ok" {
  if (stockQty <= 0) return "out";
  return stockQty <= lowStockAt ? "low" : "ok";
}
