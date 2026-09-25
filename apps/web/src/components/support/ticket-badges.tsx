import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function TicketStatusBadge({ status }: { status: string }) {
  const t = useTranslations("support");
  return (
    <Badge tone={status === "open" ? "amber" : status === "answered" ? "blue" : "gray"}>
      {t(`status_${status === "open" || status === "answered" ? status : "closed"}`)}
    </Badge>
  );
}

export function TicketPriorityBadge({ priority }: { priority: string }) {
  const t = useTranslations("support");
  return priority === "urgent" ? (
    <Badge tone="red">{t("urgent")}</Badge>
  ) : (
    <Badge tone="gray">{t("normal")}</Badge>
  );
}
