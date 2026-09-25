import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import writeXlsxFile, { type Cell, type SheetData } from "write-excel-file/node";
import {
  addDays,
  dhakaDayStart,
  formatDateShort,
  formatMonth,
  formatTimeDhaka,
  todayInDhaka,
  type Locale,
} from "@gymnode/core";
import { getActiveMembership } from "@/lib/auth";
import { MANAGEMENT } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";
import { loadReport, parseRange } from "../report-data";

const MONEY = "#,##0.00";
const head = (labels: string[]): Cell[] =>
  labels.map((value) => ({ value, fontWeight: "bold" as const }));
const taka = (paisa: number | null | undefined): Cell => ({
  value: Number(paisa ?? 0) / 100,
  format: MONEY,
});
const dhakaDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${formatDateShort(d)} ${formatTimeDhaka(d)}`;
};
const widths = (...w: number[]) => w.map((width) => ({ width }));

/**
 * The report as a real Excel file (.xlsx) with one sheet per table. Amounts are numbers in
 * taka, so an accountant can add them up. Text cells are plain text (never formulas).
 */
export async function GET(request: NextRequest) {
  const membership = await getActiveMembership();
  if (!membership || !MANAGEMENT.includes(membership.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { range } = parseRange(Object.fromEntries(request.nextUrl.searchParams));
  const report = await loadReport(membership.gymId, range);
  if (!report) return NextResponse.json({ error: "failed" }, { status: 500 });

  const t = await getTranslations("reports");
  const tm = await getTranslations("methods");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const from = dhakaDayStart(range.from).toISOString();
  const to = dhakaDayStart(addDays(range.to, 1)).toISOString();

  const [payments, expenses, sales] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "invoice_no, paid_at, kind, amount_paisa, method, transaction_id, status, members(full_name, member_code)",
      )
      .eq("gym_id", membership.gymId)
      .gte("paid_at", from)
      .lt("paid_at", to)
      .order("paid_at")
      .limit(20000),
    supabase
      .from("expenses")
      .select("spent_on, amount_paisa, note, expense_categories(name)")
      .eq("gym_id", membership.gymId)
      .is("deleted_at", null)
      .gte("spent_on", range.from)
      .lte("spent_on", range.to)
      .order("spent_on")
      .limit(20000),
    supabase
      .from("sales")
      .select(
        "created_at, payments!inner(invoice_no, status), sale_items(product_name, qty, line_total_paisa)",
      )
      .eq("gym_id", membership.gymId)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at")
      .limit(20000),
  ]);

  const net = report.income_paisa - report.expense_paisa;
  const summary: SheetData = [
    head([t("colItem"), t("colValue")]),
    [t("gym"), membership.gym.name],
    [t("from"), formatDateShort(range.from)],
    [t("to"), formatDateShort(range.to)],
    [t("totalIncome"), taka(report.income_paisa)],
    [t("totalExpense"), taka(report.expense_paisa)],
    [net >= 0 ? t("netProfit") : t("netLoss"), taka(net)],
    [t("productsTitle"), taka(report.sales_paisa)],
    [
      t("renewRate"),
      report.ended_memberships
        ? { value: report.renewed_memberships / report.ended_memberships, format: "0%" }
        : "—",
    ],
    [t("newMembers"), report.new_members],
    [t("peakHint"), report.checkins],
    [],
    [t("generated", { date: formatDateShort(todayInDhaka()) })],
  ];
  if (membership.role === "manager") summary.push([t("salaryHidden")]);

  const monthly: SheetData = [
    head([t("month"), t("income"), t("expense"), t("profit"), t("newMembers"), t("lostMembers")]),
    ...report.monthly.map((m): Cell[] => [
      formatMonth(m.month, locale),
      taka(m.income),
      taka(m.expense),
      taka(m.income - m.expense),
      m.new_members,
      m.lost_members,
    ]),
  ];

  const categories: SheetData = [
    head([t("colCategory"), t("colAmount")]),
    ...report.expense_categories.map((c): Cell[] => [c.name, taka(c.total)]),
  ];

  const statusText = (s: string) =>
    s === "completed"
      ? ts("completed")
      : s === "pending_verification"
        ? ts("pendingVerification")
        : ts("cancelled");

  const paymentRows: SheetData = [
    head([
      t("colInvoice"),
      t("colDate"),
      t("colMember"),
      t("colKind"),
      t("colAmount"),
      t("colMethod"),
      t("colTxn"),
      t("colStatus"),
    ]),
    ...(payments.data ?? []).map((p): Cell[] => {
      const m = p.members as { full_name: string; member_code: string | null } | null;
      return [
        p.invoice_no,
        dhakaDateTime(p.paid_at),
        m ? `${m.full_name}${m.member_code ? ` (${m.member_code})` : ""}` : "",
        t(`kind_${p.kind}`),
        taka(p.amount_paisa),
        tm(p.method),
        p.transaction_id ?? "",
        statusText(p.status),
      ];
    }),
  ];

  const expenseRows: SheetData = [
    head([t("colDate"), t("colCategory"), t("colAmount"), t("colNote")]),
    ...(expenses.data ?? []).map((e): Cell[] => [
      formatDateShort(e.spent_on),
      (e.expense_categories as { name: string } | null)?.name ?? "",
      taka(e.amount_paisa),
      e.note,
    ]),
  ];

  type PaymentRel = { invoice_no: string; status: string };
  const saleRows: SheetData = [
    head([
      t("colInvoice"),
      t("colDate"),
      t("colProduct"),
      t("colQty"),
      t("colAmount"),
      t("colStatus"),
    ]),
    ...(sales.data ?? []).flatMap((s) => {
      const pay = s.payments as PaymentRel | PaymentRel[];
      const p = Array.isArray(pay) ? pay[0] : pay;
      return (s.sale_items ?? []).map((i): Cell[] => [
        p?.invoice_no ?? "",
        dhakaDateTime(s.created_at),
        i.product_name,
        i.qty,
        taka(i.line_total_paisa),
        statusText(p?.status ?? ""),
      ]);
    }),
  ];

  const buffer = await writeXlsxFile([
    { data: summary, sheet: t("sheetSummary"), columns: widths(34, 22) },
    {
      data: monthly,
      sheet: t("sheetMonthly"),
      columns: widths(20, 14, 14, 14, 12, 12),
      stickyRowsCount: 1,
    },
    {
      data: categories,
      sheet: t("sheetCategories"),
      columns: widths(28, 16),
      stickyRowsCount: 1,
    },
    {
      data: paymentRows,
      sheet: t("sheetPayments"),
      columns: widths(16, 20, 28, 16, 14, 12, 18, 16),
      stickyRowsCount: 1,
    },
    {
      data: expenseRows,
      sheet: t("sheetExpenses"),
      columns: widths(14, 22, 14, 40),
      stickyRowsCount: 1,
    },
    {
      data: saleRows,
      sheet: t("sheetSales"),
      columns: widths(16, 20, 28, 8, 14, 14),
      stickyRowsCount: 1,
    },
  ]).toBuffer();

  const fileName = `gymnode-report-${range.from}-to-${range.to}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
