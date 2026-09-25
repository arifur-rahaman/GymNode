import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  daysBetween,
  formatDateShort,
  formatTaka,
  formatTimeDhaka,
  todayInDhaka,
} from "@gymnode/core";
import { GymStatusBadge } from "@/components/admin/gym-status-badge";
import { EmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/support/ticket-badges";
import { TicketReply } from "@/components/support/ticket-reply";
import { TicketThread } from "@/components/support/ticket-thread";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MANAGEMENT, hasRole, requireGym } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";
import { GymProfileForm, NewTicketForm } from "./settings-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("gymSettings");
  return { title: t("title") };
}

const TABS = ["gym", "plan", "support"] as const;
type Tab = (typeof TABS)[number];

type Usage = {
  status: string;
  trial_ends_at: string | null;
  plan: {
    name: string;
    price_paisa: number | null;
    billing_period: string;
    max_members: number | null;
    max_branches: number | null;
    max_devices: number | null;
    features: Record<string, boolean>;
  } | null;
  members: number;
  branches: number;
  current_period_end: string | null;
};

function UsageBar({
  label,
  used,
  max,
  unlimited,
}: {
  label: string;
  used: number;
  max: number | null;
  unlimited: string;
}) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="num font-semibold">
          {max ? `${used} / ${max}` : `${used} · ${unlimited}`}
        </span>
      </div>
      {max ? (
        <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <span
            className={`block h-full rounded-full ${pct >= 90 ? "bg-danger" : pct >= 75 ? "bg-warning" : "bg-chart-income"}`}
            style={{ width: `${pct}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}

export default async function GymSettingsPage({ searchParams }: PageProps<"/app/settings">) {
  const t = await getTranslations("gymSettings");
  const tb = await getTranslations("billing");
  const tbm = await getTranslations("billingMethods");
  const tp = await getTranslations("plans");
  const tf = await getTranslations("planFeatures");
  const ts = await getTranslations("support");
  const te = await getTranslations("errors");
  const membership = await requireGym();
  if (!hasRole(membership, MANAGEMENT)) return <p className="text-muted">{te("forbidden")}</p>;
  const isOwner = membership.role === "owner";
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "gym";
  const supabase = await createClient();

  let content: React.ReactNode = null;
  if (tab === "gym") {
    const { data: gym } = await supabase
      .from("gyms")
      .select("name, city, phone, address, settings, code_prefix, slug")
      .eq("id", membership.gymId)
      .single();
    const target = (gym?.settings as { monthly_target_paisa?: number } | null)
      ?.monthly_target_paisa;
    content = gym ? (
      <GymProfileForm
        canEdit={isOwner && !membership.support}
        values={{
          name: gym.name,
          city: gym.city,
          phone: gym.phone ? gym.phone.replace(/^\+88/, "") : "",
          address: gym.address,
          monthlyTargetTaka: target ? target / 100 : "",
        }}
      />
    ) : null;
  } else if (tab === "plan") {
    const [{ data: usageData }, { data: invoices }] = await Promise.all([
      supabase.rpc("gym_plan_usage", { p_gym_id: membership.gymId }),
      supabase
        .from("subscription_invoices")
        .select("id, invoice_no, amount_paisa, due_date, status, method, paid_at")
        .eq("gym_id", membership.gymId)
        .neq("status", "void")
        .order("due_date", { ascending: false })
        .limit(24),
    ]);
    const u = usageData as Usage | null;
    const today = todayInDhaka();
    const trialLeft = u?.trial_ends_at
      ? daysBetween(today, todayInDhaka(new Date(u.trial_ends_at)))
      : null;
    content = u ? (
      <div className="grid gap-5 desk:grid-cols-[1fr_1fr]">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold">{t("myPlan")}</h2>
            <GymStatusBadge status={u.status} />
          </div>
          {u.plan ? (
            <>
              <p className="text-2xl font-bold">
                {u.plan.name}{" "}
                <span className="num text-base font-normal text-muted">
                  ·{" "}
                  {u.plan.price_paisa !== null
                    ? formatTaka(Number(u.plan.price_paisa))
                    : tp("priceTbd")}{" "}
                  / {tp(`period_${u.plan.billing_period === "yearly" ? "yearly" : "monthly"}`)}
                </span>
              </p>
              {u.current_period_end ? (
                <p className="num text-sm text-muted">
                  {t("paidUntil", { date: formatDateShort(new Date(u.current_period_end)) })}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm">
              {t("trialInfo", { days: String(Math.max(trialLeft ?? 0, 0)) })}
            </p>
          )}
          <UsageBar
            label={t("members")}
            used={u.members}
            max={u.plan?.max_members ?? null}
            unlimited={t("unlimited")}
          />
          <UsageBar
            label={t("branches")}
            used={u.branches}
            max={u.plan?.max_branches ?? null}
            unlimited={t("unlimited")}
          />
          {u.plan ? (
            <ul className="flex flex-wrap gap-2">
              {Object.entries(u.plan.features)
                .filter(([, on]) => on)
                .map(([f]) => (
                  <li key={f}>
                    <Badge tone="green">{tf.has(f) ? tf(f) : f}</Badge>
                  </li>
                ))}
            </ul>
          ) : null}
          <p className="text-[13px] text-muted">
            {t("changePlan")}{" "}
            <Link href="/app/settings?tab=support" className="text-accent-text hover:underline">
              {t("contactSupport")}
            </Link>
          </p>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-[17px] font-bold">{tb("invoicesTitle")}</h2>
          {!isOwner ? (
            <p className="text-sm text-muted">{t("ownerOnlyBilling")}</p>
          ) : invoices?.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {invoices.map((inv) => {
                const overdue = inv.status === "unpaid" && inv.due_date < today;
                return (
                  <li key={inv.id} className="flex flex-col gap-1 py-2.5 text-sm">
                    <span className="flex items-center gap-3">
                      <span className="num flex-1 font-semibold">{inv.invoice_no}</span>
                      <span className="num font-semibold">
                        {formatTaka(Number(inv.amount_paisa))}
                      </span>
                      <Badge tone={inv.status === "paid" ? "green" : overdue ? "red" : "amber"}>
                        {overdue ? tb("overdue") : tb(`status_${inv.status}`)}
                      </Badge>
                    </span>
                    <span className="num text-[13px] text-muted">
                      {tb("due")} {formatDateShort(inv.due_date)}
                      {inv.method ? ` · ${tbm(inv.method)}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">{tb("noInvoices")}</p>
          )}
          {isOwner ? <p className="text-[13px] text-muted">{t("howToPay")}</p> : null}
        </Card>
      </div>
    ) : null;
  } else {
    const ticketId = typeof sp.ticket === "string" ? sp.ticket : null;
    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("id, subject, status, priority, last_message_at")
      .eq("gym_id", membership.gymId)
      .order("last_message_at", { ascending: false })
      .limit(50);
    const open = ticketId ? tickets?.find((tk) => tk.id === ticketId) : null;
    const { data: messages } = open
      ? await supabase
          .from("support_ticket_messages")
          .select("id, author_name, from_platform, body, created_at")
          .eq("ticket_id", open.id)
          .order("created_at")
      : { data: null };
    content = open ? (
      <div className="flex max-w-3xl flex-col gap-4">
        <Link
          href="/app/settings?tab=support"
          className="self-start text-sm text-muted hover:text-text"
        >
          ← {ts("allTickets")}
        </Link>
        <h2 className="text-lg font-bold">{open.subject}</h2>
        <p className="flex gap-2">
          <TicketPriorityBadge priority={open.priority} />
          <TicketStatusBadge status={open.status} />
        </p>
        <TicketThread messages={messages ?? []} teamLabel={ts("team")} viewer="gym" />
        {!membership.support ? (
          <Card>
            <TicketReply ticketId={open.id} status={open.status} viewer="gym" />
          </Card>
        ) : null}
      </div>
    ) : (
      <div className="grid gap-5 desk:grid-cols-[1fr_380px]">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-[17px] font-bold">{ts("myTickets")}</h2>
          {tickets?.length ? (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
              {tickets.map((tk) => {
                const d = new Date(tk.last_message_at);
                return (
                  <li key={tk.id}>
                    <Link
                      href={`/app/settings?tab=support&ticket=${tk.id}`}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1 font-semibold">{tk.subject}</span>
                      <TicketStatusBadge status={tk.status} />
                      <span className="num text-muted">{`${formatDateShort(d)} · ${formatTimeDhaka(d)}`}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState message={ts("noTicketsGym")} />
          )}
        </section>
        {!membership.support ? <NewTicketForm /> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
        <LinkTabs
          label={t("title")}
          items={TABS.map((key) => ({
            href: key === "gym" ? "/app/settings" : `/app/settings?tab=${key}`,
            label: t(`tab_${key}`),
            active: tab === key,
          }))}
        />
      </header>
      {content}
    </div>
  );
}
