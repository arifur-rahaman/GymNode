import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/support/ticket-badges";
import { TicketReply } from "@/components/support/ticket-reply";
import { TicketThread } from "@/components/support/ticket-thread";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("support");
  return { title: t("title") };
}

export default async function AdminTicketPage({ params }: PageProps<"/admin/support/[id]">) {
  const { id } = await params;
  const t = await getTranslations("support");
  const supabase = await createClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id, gym_id, subject, status, priority")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("support_ticket_messages")
      .select("id, author_name, from_platform, body, created_at")
      .eq("ticket_id", id)
      .order("created_at"),
  ]);
  if (!ticket) notFound();
  const { data: detail } = await supabase.rpc("admin_gym_detail", { p_gym_id: ticket.gym_id });
  const gymName = (detail as { name?: string } | null)?.name ?? "—";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link
        href="/admin/support"
        className="flex items-center gap-1.5 self-start text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t("title")}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-[22px] leading-[1.3] font-bold">{ticket.subject}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link
            href={`/admin/gyms/${ticket.gym_id}`}
            className="font-medium text-text hover:underline"
          >
            {gymName}
          </Link>
          <TicketPriorityBadge priority={ticket.priority} />
          <TicketStatusBadge status={ticket.status} />
        </p>
      </header>
      <TicketThread messages={messages ?? []} teamLabel={t("team")} viewer="team" />
      <Card>
        <TicketReply ticketId={ticket.id} status={ticket.status} viewer="team" />
      </Card>
    </div>
  );
}
