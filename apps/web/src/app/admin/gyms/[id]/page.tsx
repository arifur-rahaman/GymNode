import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatDateShort, formatTaka, formatTimeDhaka, todayInDhaka } from "@gymnode/core";
import { GymStatusBadge } from "@/components/admin/gym-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getPlatformRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InvoiceActions } from "../../billing/invoice-actions";
import { GymActions } from "./gym-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("gymsTitle") };
}

export type GymDetail = {
  id: string;
  name: string;
  code_prefix: string;
  slug: string;
  city: string;
  address: string;
  phone: string | null;
  raw_status: string;
  status: string;
  trial_ends_at: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  plan_id: string | null;
  plan_name: string | null;
  price_override_paisa: number | null;
  monthly_price: number | null;
  current_period_end: string | null;
  owner: {
    name: string;
    email: string | null;
    phone: string | null;
    last_sign_in_at: string | null;
  };
  members: number;
  branches: number;
  staff: number;
  last_login: string | null;
  payments_month_paisa: number;
  invoices: {
    id: string;
    invoice_no: string;
    amount_paisa: number;
    due_date: string;
    status: string;
    method: string | null;
    paid_at: string | null;
    period_start: string | null;
    overdue: boolean;
  }[];
  tickets: {
    id: string;
    subject: string;
    status: string;
    priority: string;
    last_message_at: string;
  }[];
  audit: { action: string; created_at: string; actor_kind: string; reason: string | null }[];
};

function dateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${formatDateShort(d)} · ${formatTimeDhaka(d)}`;
}

export default async function AdminGymPage({ params }: PageProps<"/admin/gyms/[id]">) {
  const { id } = await params;
  const t = await getTranslations("admin");
  const tb = await getTranslations("billing");
  const tm = await getTranslations("billingMethods");
  const supabase = await createClient();
  const [{ data, error }, { data: plans }, role] = await Promise.all([
    supabase.rpc("admin_gym_detail", { p_gym_id: id }),
    supabase.from("plans").select("id, name, price_paisa").order("sort_order"),
    getPlatformRole(),
  ]);
  if (error || !data) notFound();
  const g = data as unknown as GymDetail;
  const isSuper = role === "super_admin";

  const facts: [string, React.ReactNode][] = [
    [t("owner"), `${g.owner.name || "—"}${g.owner.email ? ` · ${g.owner.email}` : ""}`],
    [
      t("phone"),
      <span key="p" className="num">
        {(g.owner.phone ?? g.phone ?? "—").replace(/^\+88/, "")}
      </span>,
    ],
    [t("colCity"), g.city || "—"],
    [t("colPlan"), g.plan_name ?? t("noPlan")],
    [
      t("colBill"),
      <span key="b" className="num">
        {g.monthly_price !== null ? formatTaka(Number(g.monthly_price)) : "—"}
      </span>,
    ],
    [
      g.raw_status === "trial" ? t("trialEnds") : t("paidUntil"),
      <span key="d" className="num">
        {g.raw_status === "trial"
          ? g.trial_ends_at
            ? formatDateShort(new Date(g.trial_ends_at))
            : "—"
          : g.current_period_end
            ? formatDateShort(new Date(g.current_period_end))
            : "—"}
      </span>,
    ],
    [
      t("colJoined"),
      <span key="j" className="num">
        {formatDateShort(new Date(g.created_at))}
      </span>,
    ],
    [
      t("colLastLogin"),
      <span key="l" className="num">
        {dateTime(g.last_login)}
      </span>,
    ],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/gyms"
        className="flex items-center gap-1.5 self-start text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t("gymsTitle")}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-md bg-surface-2 font-bold"
          >
            {g.code_prefix}
          </span>
          <div>
            <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{g.name}</h1>
            <p className="text-sm text-muted">{g.city || "—"}</p>
          </div>
          <GymStatusBadge status={g.status} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [t("colMembers"), g.members],
          [t("staff"), g.staff],
          [t("branches"), g.branches],
          [t("paymentsMonth"), formatTaka(Number(g.payments_month_paisa))],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4"
          >
            <span className="text-[13px] text-muted">{label}</span>
            <span className="num text-2xl font-bold">{value}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 desk:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <dl className="grid gap-x-6 sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 border-b border-border py-2.5 text-sm"
                >
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <section className="flex flex-col gap-3">
            <h2 className="text-[17px] font-bold">{tb("invoicesTitle")}</h2>
            {g.invoices.length ? (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
                {g.invoices.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <span className="num w-32 font-semibold">{inv.invoice_no}</span>
                    <span className="num w-24">{formatTaka(Number(inv.amount_paisa))}</span>
                    <span className="num flex-1 text-muted">
                      {tb("due")} {formatDateShort(inv.due_date)}
                      {inv.method ? ` · ${tm(inv.method)}` : ""}
                    </span>
                    <Badge
                      tone={
                        inv.status === "paid"
                          ? "green"
                          : inv.status === "void"
                            ? "gray"
                            : inv.overdue
                              ? "red"
                              : "amber"
                      }
                    >
                      {inv.status === "unpaid" && inv.overdue
                        ? tb("overdue")
                        : tb(`status_${inv.status}`)}
                    </Badge>
                    {isSuper && inv.status === "unpaid" ? (
                      <InvoiceActions
                        invoiceId={inv.id}
                        label={inv.invoice_no}
                        today={todayInDhaka()}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{tb("noInvoices")}</p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[17px] font-bold">{t("ticketsTitle")}</h2>
            {g.tickets.length ? (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
                {g.tickets.map((tk) => (
                  <li key={tk.id}>
                    <Link
                      href={`/admin/support/${tk.id}`}
                      className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-2"
                    >
                      <span className="flex-1 font-medium">{tk.subject}</span>
                      <span className="num text-muted">
                        {formatDateShort(new Date(tk.last_message_at))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("noTickets")}</p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[17px] font-bold">{t("historyTitle")}</h2>
            {g.audit.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {g.audit.map((a, i) => (
                  <li key={`${a.created_at}-${i}`} className="flex flex-wrap gap-x-3">
                    <span className="num text-muted">{dateTime(a.created_at)}</span>
                    <span className="font-medium">
                      {t.has(`audit.${a.action}`) ? t(`audit.${a.action}`) : a.action}
                    </span>
                    {a.reason ? <span className="text-muted">— {a.reason}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("noHistory")}</p>
            )}
          </section>
        </div>

        <GymActions
          gym={{
            id: g.id,
            name: g.name,
            rawStatus: g.raw_status,
            planId: g.plan_id,
            priceOverride: g.price_override_paisa,
            monthlyPrice: g.monthly_price,
          }}
          plans={(plans ?? []).map((p) => ({ id: p.id, name: p.name, pricePaisa: p.price_paisa }))}
          isSuper={isSuper}
          today={todayInDhaka()}
        />
      </div>
    </div>
  );
}
