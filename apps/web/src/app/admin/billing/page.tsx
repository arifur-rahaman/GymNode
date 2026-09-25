import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatDateShort, formatMonth, formatTaka, todayInDhaka, type Locale } from "@gymnode/core";
import { getLocale } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { LinkTabs } from "@/components/link-tabs";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { Badge } from "@/components/ui/badge";
import { getPlatformRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GenerateInvoices } from "./generate-button";
import { InvoiceActions } from "./invoice-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("title") };
}

const TABS = ["unpaid", "overdue", "paid", "void"] as const;

type Row = {
  id: string;
  invoice_no: string;
  gym_id: string;
  gym_name: string;
  plan_name: string | null;
  amount_paisa: number;
  due_date: string;
  status: string;
  method: string | null;
  transaction_id: string | null;
  period_start: string | null;
  overdue: boolean;
};

type Result = {
  counts: {
    all: number;
    unpaid: number;
    overdue: number;
    paid: number;
    unpaid_paisa: number;
    paid_month_paisa: number;
  };
  rows: Row[];
};

export default async function AdminBillingPage({ searchParams }: PageProps<"/admin/billing">) {
  const t = await getTranslations("billing");
  const tm = await getTranslations("billingMethods");
  const te = await getTranslations("errors");
  const locale = (await getLocale()) as Locale;
  const sp = await searchParams;
  const status = TABS.includes(sp.status as (typeof TABS)[number]) ? (sp.status as string) : null;
  const supabase = await createClient();
  const [{ data }, role] = await Promise.all([
    supabase.rpc("admin_list_invoices", { p_status: status as string, p_limit: 200 }),
    getPlatformRole(),
  ]);
  const r = data as Result | null;
  if (!r) return <p className="text-muted">{te("unknown")}</p>;
  const isSuper = role === "super_admin";
  const today = todayInDhaka();

  const columns: Column<Row>[] = [
    {
      key: "no",
      header: t("colInvoice"),
      width: "minmax(max-content, 1fr)",
      cell: (i) => <span className="num font-semibold">{i.invoice_no}</span>,
    },
    {
      key: "gym",
      header: t("colGym"),
      width: "1.5fr",
      primary: true,
      cell: (i) => (
        <Link href={`/admin/gyms/${i.gym_id}`} className="font-semibold hover:underline">
          {i.gym_name}
        </Link>
      ),
    },
    { key: "plan", header: t("colPlan"), cell: (i) => i.plan_name ?? "—" },
    {
      key: "month",
      header: t("month"),
      cell: (i) => (i.period_start ? formatMonth(i.period_start, locale) : "—"),
    },
    {
      key: "amount",
      header: t("amount"),
      cell: (i) => <span className="num font-semibold">{formatTaka(Number(i.amount_paisa))}</span>,
    },
    {
      key: "due",
      header: t("dueDate"),
      cell: (i) => (
        <span className={`num ${i.overdue ? "text-danger" : "text-muted"}`}>
          {formatDateShort(i.due_date)}
        </span>
      ),
    },
    { key: "method", header: t("method"), cell: (i) => (i.method ? tm(i.method) : "—") },
    {
      key: "status",
      header: t("colStatus"),
      cell: (i) => (
        <Badge
          tone={
            i.status === "paid"
              ? "green"
              : i.status === "void"
                ? "gray"
                : i.overdue
                  ? "red"
                  : "amber"
          }
        >
          {i.status === "unpaid" && i.overdue ? t("overdue") : t(`status_${i.status}`)}
        </Badge>
      ),
    },
    ...(isSuper
      ? [
          {
            key: "actions",
            header: <span className="sr-only md:not-sr-only">{t("colActions")}</span>,
            width: "minmax(max-content, 1.2fr)",
            align: "end" as const,
            mobileFooter: true,
            cell: (i: Row) =>
              i.status === "unpaid" ? (
                <InvoiceActions
                  invoiceId={i.id}
                  label={`${i.invoice_no} · ${i.gym_name}`}
                  today={today}
                />
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        {isSuper ? <GenerateInvoices month={today.slice(0, 7)} /> : null}
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label={t("paidMonth")}
          value={formatTaka(Number(r.counts.paid_month_paisa))}
          tone="accent"
        />
        <KpiCard
          label={t("unpaidTotal")}
          value={formatTaka(Number(r.counts.unpaid_paisa))}
          tone="warning"
          sub={t("invoicesCount", { count: String(r.counts.unpaid) })}
        />
        <KpiCard label={t("overdue")} value={String(r.counts.overdue)} tone="danger" />
        <KpiCard label={t("paidCount")} value={String(r.counts.paid)} />
      </div>

      <LinkTabs
        label={t("title")}
        items={[null, ...TABS].map((s) => ({
          href: s ? `/admin/billing?status=${s}` : "/admin/billing",
          label: t(s ? `tab_${s}` : "tab_all"),
          active: status === s,
          count: s === "void" ? undefined : r.counts[s ?? "all"],
        }))}
      />

      {r.rows.length ? (
        <ResponsiveTable
          caption={t("invoicesTitle")}
          columns={columns}
          rows={r.rows}
          rowKey={(i) => i.id}
        />
      ) : (
        <EmptyState message={t("noInvoices")} />
      )}
      <p className="text-[13px] text-muted">{t("pricesNote")}</p>
    </div>
  );
}
