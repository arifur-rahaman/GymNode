"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { replyTicket, setTicketStatus } from "@/app/admin/actions";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/lib/use-error-text";

/** Reply box + status buttons under a ticket thread (team: any status; gym: close only). */
export function TicketReply({
  ticketId,
  status,
  viewer,
}: {
  ticketId: string;
  status: string;
  viewer: "team" | "gym";
}) {
  const t = useTranslations("support");
  const errorText = useErrorText();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await replyTicket(ticketId, { body });
          if (res.ok) {
            setBody("");
            toast.success(t("replied"));
          } else setError(res.fieldErrors?.body ?? res.formError ?? "unknown");
        });
      }}
    >
      <FormError message={errorText(error)} />
      <label htmlFor={`reply-${ticketId}`} className="text-sm font-medium">
        {t("reply")}
      </label>
      <textarea
        id={`reply-${ticketId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={2000}
        className="min-h-28 rounded-md border border-border bg-bg px-3.5 py-3 text-[15px] outline-none focus-visible:border-accent"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !body.trim()}>
          {t("send")}
        </Button>
        {status !== "closed" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await setTicketStatus(ticketId, "closed");
                if (res.ok) toast.success(t("closedDone"));
                else toast.error(errorText(res.formError));
              })
            }
          >
            {t("close")}
          </Button>
        ) : viewer === "team" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await setTicketStatus(ticketId, "open");
                if (!res.ok) toast.error(errorText(res.formError));
              })
            }
          >
            {t("reopen")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
