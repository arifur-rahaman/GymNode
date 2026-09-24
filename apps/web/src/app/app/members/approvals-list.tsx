"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/members/member-avatar";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/lib/use-error-text";
import { approveMember, rejectMember } from "./actions";

/** QR sign-ups waiting for reception: approve gives a member code, reject removes the request. */
export function ApprovalsList({ rows }: { rows: { id: string; name: string; phone: string }[] }) {
  const t = useTranslations("members");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) return <EmptyState message={t("noApprovals")} />;

  return (
    <section aria-label={t("approvals")} className="rounded-lg border border-border bg-surface">
      <h2 className="border-b border-border px-5 py-3 text-sm text-muted">{t("approvals")}</h2>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <MemberAvatar name={r.name} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{r.name}</span>
              <span className="num text-xs text-muted">{r.phone}</span>
            </span>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await approveMember(r.id);
                  if (res.ok) toast.success(t("approved", { name: r.name }));
                  else toast.error(errorText(res.formError));
                })
              }
            >
              <Check /> {tc("approve")}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await rejectMember(r.id);
                  if (res.ok) toast.success(t("rejected"));
                  else toast.error(errorText(res.formError));
                })
              }
            >
              <X /> {tc("reject")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
