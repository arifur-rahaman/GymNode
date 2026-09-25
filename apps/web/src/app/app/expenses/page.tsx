import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  addMonths,
  dhakaDayStart,
  formatMonth,
  formatTaka,
  todayInDhaka,
  type Locale,
} from "@gymnode/core";
import { BarList } from "@/components/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MANAGEMENT, hasRole, requireGym } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";
import { ExpensesManager, type Category, type ExpenseRow } from "./expenses-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expenses");
  return { title: t("title") };
}

export default async function ExpensesPage({ searchParams }: PageProps<"/app/expenses">) {
  const t = await getTranslations("expenses");
  const te = await getTranslations("errors");
  const locale = (await getLocale()) as Locale;
  const membership = await requireGym();
  if (!hasRole(membership, MANAGEMENT)) return <p className="text-muted">{te("forbidden")}</p>;

  const sp = await searchParams;
  const today = todayInDhaka();
  const thisMonth = `${today.slice(0, 7)}-01`;
  const month =
    typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) && `${sp.month}-01` <= thisMonth
      ? `${sp.month}-01`
      : thisMonth;
  const nextMonth = addMonths(month, 1);
  const categoryFilter = typeof sp.cat === "string" ? sp.cat : null;
  const supabase = await createClient();

  const [cats, expenses, income, staff] = await Promise.all([
    supabase
      .from("expense_categories")
      .select("id, name, is_salary, is_active, sort_order")
      .eq("gym_id", membership.gymId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("expenses")
      .select("id, category_id, amount_paisa, spent_on, note, created_by")
      .eq("gym_id", membership.gymId)
      .is("deleted_at", null)
      .gte("spent_on", month)
      .lt("spent_on", nextMonth)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.rpc("payment_stats", {
      p_gym_id: membership.gymId,
      p_from: dhakaDayStart(month).toISOString(),
      p_to: dhakaDayStart(nextMonth).toISOString(),
    }),
    supabase.from("gym_users").select("user_id, display_name").eq("gym_id", membership.gymId),
  ]);

  const categories: Category[] = (cats.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    isSalary: c.is_salary,
    isActive: c.is_active,
  }));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const names = new Map((staff.data ?? []).map((s) => [s.user_id, s.display_name]));
  const all: ExpenseRow[] = (expenses.data ?? []).map((e) => ({
    id: e.id,
    categoryId: e.category_id,
    category: catName.get(e.category_id) ?? "—",
    amount: e.amount_paisa,
    spentOn: e.spent_on,
    note: e.note,
    by: names.get(e.created_by ?? "") ?? "—",
  }));
  const rows = categoryFilter ? all.filter((r) => r.categoryId === categoryFilter) : all;

  const expenseTotal = all.reduce((s, r) => s + r.amount, 0);
  const incomeTotal = Number((income.data as { total_paisa?: number } | null)?.total_paisa ?? 0);
  const net = incomeTotal - expenseTotal;
  const byCategory = [...Map.groupBy(all, (r) => r.categoryId)]
    .map(([id, list]) => ({
      key: id,
      label: catName.get(id) ?? "—",
      value: list.reduce((s, r) => s + r.amount, 0),
    }))
    .sort((a, b) => b.value - a.value);

  const monthHref = (m: string) =>
    `/app/expenses${m === thisMonth ? "" : `?month=${m.slice(0, 7)}`}`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface p-1">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={monthHref(addMonths(month, -1))} aria-label={t("prevMonth")}>
              <ChevronLeft />
            </Link>
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold" aria-live="polite">
            {formatMonth(month, locale)}
          </span>
          {nextMonth <= thisMonth ? (
            <Button asChild variant="ghost" size="icon-sm">
              <Link href={monthHref(nextMonth)} aria-label={t("nextMonth")}>
                <ChevronRight />
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="icon-sm" disabled aria-label={t("nextMonth")}>
              <ChevronRight />
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label={t("income")}
          value={formatTaka(incomeTotal)}
          tone="accent"
          sub={t("incomeSub")}
        />
        <KpiCard
          label={t("expense")}
          value={formatTaka(expenseTotal)}
          sub={t("expenseSub", { count: String(all.length) })}
        />
        <KpiCard
          label={net >= 0 ? t("net") : t("netLoss")}
          value={formatTaka(net)}
          tone={net >= 0 ? "success" : "danger"}
          sub={
            incomeTotal > 0
              ? t("margin", { pct: String(Math.round((net / incomeTotal) * 100)) })
              : undefined
          }
        />
      </div>
      {membership.role === "manager" ? (
        <p className="text-sm text-muted">{t("salaryHidden")}</p>
      ) : null}

      <div className="grid gap-5 desk:grid-cols-[2fr_1fr]">
        <ExpensesManager
          rows={rows}
          categories={categories}
          activeCategory={categoryFilter}
          month={month}
          today={today}
          isOwner={membership.role === "owner"}
        />
        <Card className="flex flex-col gap-4 self-start">
          <h2 className="text-[17px] font-bold">{t("byCategory")}</h2>
          {byCategory.length ? (
            <BarList items={byCategory.map((c) => ({ ...c, display: formatTaka(c.value) }))} />
          ) : (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
