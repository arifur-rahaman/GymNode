"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, MessageCircle, ReceiptText, Search } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import {
  dueSchema,
  formatDateShort,
  formatTaka,
  maskBdPhone,
  needsTransactionId,
  type DueInput,
  type IsoDate,
  type MemberDisplayStatus,
  type PaymentMethod,
} from "@gymnode/core";
import {
  searchPaymentMembers,
  takeDuePayment,
  takeRenewalPayment,
  type PaymentDone,
  type PaymentMember,
} from "@/app/app/payments/actions";
import { FormError } from "@/components/form-error";
import { MemberAvatar } from "@/components/members/member-avatar";
import { whatsappUrl } from "@/components/members/whatsapp-link";
import { MemberStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useErrorText } from "@/lib/use-error-text";
import { MethodPicker } from "./method-picker";
import { PaymentFields, usePaymentForm, type PackageOption } from "./payment-fields";

type Props = {
  packages: PackageOption[];
  today: IsoDate;
  gymName: string;
  siteUrl: string;
  initialMember?: PaymentMember | null;
  onDone?: () => void;
};

/** The "পেমেন্ট নিন" panel from Payments.dc.html: find member → renew or pay due → receipt. */
export function TakePaymentPanel({
  packages,
  today,
  gymName,
  siteUrl,
  initialMember = null,
  onDone,
}: Props) {
  const t = useTranslations("payments");
  const [member, setMember] = useState<PaymentMember | null>(initialMember);
  const [mode, setMode] = useState<"renew" | "due">(
    initialMember && initialMember.duePaisa > 0 ? "due" : "renew",
  );
  const [done, setDone] = useState<(PaymentDone & { member: PaymentMember }) | null>(null);

  if (done) {
    const receiptUrl = `${siteUrl}/r/${done.receiptToken}`;
    return (
      <div role="status" className="flex flex-col gap-4">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <div>
          <h3 className="text-[17px] font-bold">{t("doneTitle")}</h3>
          <p className="num text-sm text-muted">
            {done.member.name} · {t("doneInvoice", { invoice: done.invoiceNo })}
          </p>
        </div>
        {done.receiptToken ? (
          <div className="flex flex-wrap gap-2.5">
            <Button asChild variant="secondary">
              <Link href={`/r/${done.receiptToken}`} target="_blank">
                <ReceiptText /> {t("openReceipt")}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <a
                href={whatsappUrl(
                  done.member.phone,
                  t("receiptText", { gym: gymName, invoice: done.invoiceNo, url: receiptUrl }),
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="text-success" /> {t("shareReceipt")}
              </a>
            </Button>
          </div>
        ) : null}
        <Button
          onClick={() => {
            setDone(null);
            setMember(null);
          }}
        >
          {t("newPayment")}
        </Button>
      </div>
    );
  }

  if (!member)
    return (
      <MemberSearch
        onPick={(m) => {
          setMember(m);
          setMode(
            m.duePaisa > 0 && m.hasMembership && m.endDate && m.endDate >= today ? "due" : "renew",
          );
        }}
      />
    );

  const finish = (result: PaymentDone) => {
    setDone({ ...result, member });
    onDone?.();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-md bg-surface-2 p-3">
        <MemberAvatar name={member.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{member.name}</p>
          <p className="num text-xs text-muted">
            {member.code} · {member.endDate ? formatDateShort(member.endDate) : "—"}
          </p>
        </div>
        <MemberStatusBadge status={member.status as MemberDisplayStatus} />
      </div>
      <button
        type="button"
        onClick={() => setMember(null)}
        className="self-start text-sm text-accent-text underline-offset-4 hover:underline"
      >
        {t("changeMember")}
      </button>

      {member.duePaisa > 0 ? (
        <Segmented
          aria-label={t("take")}
          value={mode}
          onValueChange={(v) => setMode(v as "renew" | "due")}
          items={[
            { value: "renew", label: t("modeRenew") },
            { value: "due", label: t("modeDue") },
          ]}
        />
      ) : null}

      {mode === "renew" ? (
        <RenewForm
          key={member.id}
          member={member}
          packages={packages}
          today={today}
          onDone={finish}
        />
      ) : (
        <DueForm key={member.id} member={member} onDone={finish} />
      )}
    </div>
  );
}

export function MemberSearch({ onPick }: { onPick: (m: PaymentMember) => void }) {
  const t = useTranslations("payments");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PaymentMember[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = setTimeout(
      () => startTransition(async () => setResults(await searchPaymentMembers(q))),
      300,
    );
    return () => clearTimeout(id);
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("memberSearch")}</span>
        <span className="flex h-12 items-center gap-2 rounded-md border border-border bg-bg px-3.5 focus-within:border-accent">
          <Search className="size-[18px] text-muted" aria-hidden />
          <input
            type="search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("memberSearchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
        </span>
      </label>
      {q.trim().length >= 2 && results ? (
        results.length ? (
          <ul
            className={`flex flex-col divide-y divide-border rounded-md border border-border ${pending ? "opacity-70" : ""}`}
          >
            {results.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2"
                >
                  <MemberAvatar name={m.name} size={34} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{m.name}</span>
                    <span className="num text-xs text-muted">
                      {m.code} · {maskBdPhone(m.phone)}
                    </span>
                  </span>
                  {m.duePaisa > 0 ? (
                    <span className="num text-sm font-semibold text-warning">
                      {formatTaka(m.duePaisa)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("noMatch")}</p>
        )
      ) : null}
    </div>
  );
}

function RenewForm({
  member,
  packages,
  today,
  onDone,
}: {
  member: PaymentMember;
  packages: PackageOption[];
  today: IsoDate;
  onDone: (r: PaymentDone) => void;
}) {
  const tp = useTranslations("payment");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = usePaymentForm(
    packages.some((p) => p.id === member.packageId) ? member.packageId! : packages[0]?.id,
  );

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await takeRenewalPayment(member.id, form.getValues());
      if (res.ok) onDone(res.data!);
      else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as "packageId", { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <PaymentFields
        form={form}
        packages={packages}
        today={today}
        currentEndDate={member.endDate}
        isFirstMembership={!member.hasMembership}
        previousDuePaisa={member.duePaisa}
        idPrefix="tp"
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? tp("confirming") : tp("confirm")}
      </Button>
    </form>
  );
}

function DueForm({ member, onDone }: { member: PaymentMember; onDone: (r: PaymentDone) => void }) {
  const t = useTranslations("payments");
  const tp = useTranslations("payment");
  const tm = useTranslations("methods");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<DueInput, unknown, z.output<typeof dueSchema>>({
    resolver: zodResolver(dueSchema),
    defaultValues: { amountTaka: member.duePaisa / 100, method: "cash", transactionId: "" },
  });
  const method = useWatch({ control: form.control, name: "method" }) as PaymentMethod;
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await takeDuePayment(member.id, form.getValues());
      if (res.ok) onDone(res.data!);
      else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as "amountTaka", { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <p className="num text-sm font-semibold text-warning">
        {t("currentDue", { amount: formatTaka(member.duePaisa) })}
      </p>
      <Field id="due-amount" label={t("dueAmount")} error={errorText(errors.amountTaka?.message)}>
        <Input inputMode="decimal" className="num" {...form.register("amountTaka")} />
      </Field>
      <MethodPicker
        value={method}
        onChange={(m) => form.setValue("method", m, { shouldValidate: true })}
      />
      {needsTransactionId(method) ? (
        <Field
          id="due-txn"
          label={tp("transactionId", { method: tm(method) })}
          hint={tp("pendingNote")}
          error={errorText(errors.transactionId?.message)}
        >
          <Input className="num uppercase" autoComplete="off" {...form.register("transactionId")} />
        </Field>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? tp("confirming") : tp("confirm")}
      </Button>
    </form>
  );
}
