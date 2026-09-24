import { useTranslations } from "next-intl";
import { statusTone, type MemberDisplayStatus } from "@gymnode/core";
import { Badge } from "@/components/ui/badge";

/** Member status badge: colour from @gymnode/core, label from translations. */
function MemberStatusBadge({ status }: { status: MemberDisplayStatus }) {
  const t = useTranslations("status");
  return <Badge tone={statusTone[status]}>{t(status)}</Badge>;
}

export { MemberStatusBadge };
