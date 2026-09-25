import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatDateShort, formatTimeDhaka } from "@gymnode/core";
import { EmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/support/ticket-badges";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("support");
  return { title: t("title") };
}

const TABS = ["open", "answered", "closed"] as const;

type Row = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  last_message_at: string;
  gym_id: string;
  gym_name: string;
};

export default async function AdminSupportPage({ searchParams }: PageProps<"/admin/support">) {
  const t = await getTranslations("support");
  const sp = await searchParams;
  const status = TABS.includes(sp.status as (typeof TABS)[number]) ? (sp.status as string) : "open";
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_tickets", { p_status: status, p_limit: 200 });
  const r = (data ?? { counts: {}, rows: [] }) as { counts: Record<string, number>; rows: Row[] };

  const columns: Column<Row>[] = [
    {
      key: "subject",
      header: t("colSubject"),
      width: "2fr",
      primary: true,
      cell: (tk) => (
        <Link href={`/admin/support/${tk.id}`} className="font-semibold hover:underline">
          {tk.subject}
        </Link>
      ),
    },
    {
      key: "gym",
      header: t("colGym"),
      cell: (tk) => (
        <Link href={`/admin/gyms/${tk.gym_id}`} className="hover:underline">
          {tk.gym_name}
        </Link>
      ),
    },
    {
      key: "priority",
      header: t("colPriority"),
      cell: (tk) => <TicketPriorityBadge priority={tk.priority} />,
    },
    {
      key: "status",
      header: t("colStatus"),
      cell: (tk) => <TicketStatusBadge status={tk.status} />,
    },
    {
      key: "time",
      header: t("colUpdated"),
      cell: (tk) => {
        const d = new Date(tk.last_message_at);
        return (
          <span className="num text-muted">{`${formatDateShort(d)} · ${formatTimeDhaka(d)}`}</span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
        <LinkTabs
          label={t("title")}
          items={TABS.map((s) => ({
            href: s === "open" ? "/admin/support" : `/admin/support?status=${s}`,
            label: t(`status_${s}`),
            active: status === s,
            count: r.counts[s] ?? 0,
          }))}
        />
      </header>
      {r.rows.length ? (
        <ResponsiveTable
          caption={t("title")}
          columns={columns}
          rows={r.rows}
          rowKey={(tk) => tk.id}
        />
      ) : (
        <EmptyState icon={<LifeBuoy />} message={t("empty")} />
      )}
    </div>
  );
}
