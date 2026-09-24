"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, ReceiptText, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useErrorText } from "@/lib/use-error-text";
import { cancelPayment, verifyPayment } from "./actions";

/** Receipt link + verify (owner/manager) + cancel with reason. */
export function PaymentRowActions({
  paymentId,
  receiptToken,
  label,
  canVerify,
  canCancel,
}: {
  paymentId: string;
  receiptToken: string;
  label: string;
  canVerify: boolean;
  canCancel: boolean;
}) {
  const t = useTranslations("payments");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex flex-wrap justify-end gap-2">
      <Link
        href={`/r/${receiptToken}`}
        target="_blank"
        aria-label={`${t("receipt")}: ${label}`}
        title={t("receipt")}
        className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-surface hover:bg-surface-2"
      >
        <ReceiptText className="size-[18px]" aria-hidden />
      </Link>
      {canVerify ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await verifyPayment(paymentId);
              if (res.ok) toast.success(t("verified"));
              else toast.error(errorText(res.formError));
            })
          }
        >
          <BadgeCheck /> {t("verify")}
        </Button>
      ) : null}
      {canCancel ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon-sm"
              variant="danger"
              aria-label={`${t("cancel")}: ${label}`}
              title={t("cancel")}
            >
              <XCircle />
            </Button>
          </SheetTrigger>
          <SheetContent closeLabel={tc("close")}>
            <SheetTitle>{t("cancelTitle")}</SheetTitle>
            <SheetDescription className="mt-1">{label}</SheetDescription>
            <form
              className="mt-5 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                startTransition(async () => {
                  const res = await cancelPayment(paymentId, { reason });
                  if (res.ok) {
                    toast.success(t("cancelled"));
                    setOpen(false);
                  } else setError(res.fieldErrors?.reason ?? res.formError ?? "unknown");
                });
              }}
            >
              <p className="text-sm text-muted">{t("cancelHint")}</p>
              <FormError message={errorText(error)} />
              <Field id={`cancel-${paymentId}`} label={t("cancelReason")}>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Button type="submit" variant="danger" size="lg" disabled={pending}>
                {t("cancel")}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      ) : null}
    </span>
  );
}
