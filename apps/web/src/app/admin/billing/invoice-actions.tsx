"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BILLING_METHODS,
  invoicePaidSchema,
  type InvoicePaidInput,
  type IsoDate,
} from "@gymnode/core";
import { markInvoicePaid, voidInvoice } from "@/app/admin/actions";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useErrorText } from "@/lib/use-error-text";

/** "Paid" (with method + transaction ID) and "void" (with reason) for an unpaid invoice. */
export function InvoiceActions({
  invoiceId,
  label,
  today,
}: {
  invoiceId: string;
  label: string;
  today: IsoDate;
}) {
  const t = useTranslations("billing");
  const tc = useTranslations("common");
  const [open, setOpen] = useState<"paid" | "void" | null>(null);
  return (
    <span className="flex gap-2">
      <Button size="sm" onClick={() => setOpen("paid")}>
        {t("markPaid")}
      </Button>
      <Button size="sm" variant="danger" onClick={() => setOpen("void")}>
        {t("void")}
      </Button>
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent closeLabel={tc("close")}>
          <SheetTitle>{open === "void" ? t("voidTitle") : t("paidTitle")}</SheetTitle>
          <SheetDescription className="num mt-1">{label}</SheetDescription>
          {open === "paid" ? (
            <PaidForm invoiceId={invoiceId} today={today} onDone={() => setOpen(null)} />
          ) : open === "void" ? (
            <VoidForm invoiceId={invoiceId} onDone={() => setOpen(null)} />
          ) : null}
        </SheetContent>
      </Sheet>
    </span>
  );
}

function PaidForm({
  invoiceId,
  today,
  onDone,
}: {
  invoiceId: string;
  today: IsoDate;
  onDone: () => void;
}) {
  const t = useTranslations("billing");
  const tm = useTranslations("billingMethods");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<InvoicePaidInput>({
    resolver: zodResolver(invoicePaidSchema),
    defaultValues: { method: "bkash", transactionId: "", paidOn: today },
  });
  const method = useWatch({ control: form.control, name: "method" });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await markInvoicePaid(invoiceId, form.getValues());
      if (res.ok) {
        toast.success(t("paidDone"));
        onDone();
      } else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as keyof InvoicePaidInput, { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });
  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field id="ip-method" label={t("method")}>
        <NativeSelect {...form.register("method")}>
          {BILLING_METHODS.map((m) => (
            <option key={m} value={m}>
              {tm(m)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {!["cash", "card", "bank"].includes(method) ? (
        <Field
          id="ip-txn"
          label={t("transactionId")}
          error={errorText(errors.transactionId?.message)}
        >
          <Input className="num" {...form.register("transactionId")} />
        </Field>
      ) : null}
      <Field id="ip-date" label={t("paidOn")} error={errorText(errors.paidOn?.message)}>
        <Input type="date" className="num" {...form.register("paidOn")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {t("markPaid")}
      </Button>
    </form>
  );
}

function VoidForm({ invoiceId, onDone }: { invoiceId: string; onDone: () => void }) {
  const t = useTranslations("billing");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-5 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await voidInvoice(invoiceId, { reason });
          if (res.ok) {
            toast.success(t("voided"));
            onDone();
          } else setError(res.fieldErrors?.reason ?? res.formError ?? "unknown");
        });
      }}
    >
      <p className="text-sm text-muted">{t("voidHint")}</p>
      <FormError message={errorText(error)} />
      <Field id={`void-${invoiceId}`} label={t("reason")}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Button type="submit" variant="danger" size="lg" disabled={pending}>
        {t("void")}
      </Button>
    </form>
  );
}
