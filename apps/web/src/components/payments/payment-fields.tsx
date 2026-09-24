"use client";

import { useEffect } from "react";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  PAYMENT_METHODS,
  formatDateShort,
  formatTaka,
  needsTransactionId,
  paymentSchema,
  renewalQuote,
  takaToPaisa,
  type IsoDate,
  type PaymentInput,
  type PaymentMethod,
} from "@gymnode/core";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useErrorText } from "@/lib/use-error-text";
import { cn } from "@/lib/utils";

export type PackageOption = {
  id: string;
  name: string;
  duration_days: number;
  price_paisa: number;
  admission_fee_paisa: number;
};

export function usePaymentForm(defaultPackageId?: string) {
  return useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      packageId: defaultPackageId ?? "",
      amountTaka: 0,
      discountTaka: 0,
      method: "cash",
      transactionId: "",
    },
  });
}

function toNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Package + amount + discount + method + transaction ID, with a live preview of the new
 * expiry date and total (the "take payment" panel from Payments.dc.html).
 */
export function PaymentFields({
  form,
  packages,
  today,
  currentEndDate,
  isFirstMembership,
  previousDuePaisa = 0,
  idPrefix = "pay",
}: {
  form: UseFormReturn<PaymentInput>;
  packages: PackageOption[];
  today: IsoDate;
  currentEndDate: IsoDate | null;
  isFirstMembership: boolean;
  previousDuePaisa?: number;
  idPrefix?: string;
}) {
  const t = useTranslations("payment");
  const tm = useTranslations("methods");
  const errorText = useErrorText();
  const { errors } = form.formState;
  const [packageId, discountTaka, amountTaka, method] = useWatch({
    control: form.control,
    name: ["packageId", "discountTaka", "amountTaka", "method"],
  });

  const pkg = packages.find((p) => p.id === packageId);
  const quote = pkg
    ? renewalQuote({
        today,
        currentEndDate,
        durationDays: pkg.duration_days,
        pricePaisa: pkg.price_paisa,
        admissionFeePaisa: pkg.admission_fee_paisa,
        chargeAdmission: isFirstMembership,
        discountPaisa: takaToPaisa(toNumber(discountTaka)),
      })
    : null;
  const totalPaisa = quote ? quote.chargesPaisa + previousDuePaisa : 0;
  const leftDuePaisa = Math.max(totalPaisa - takaToPaisa(toNumber(amountTaka)), 0);

  // Fill in the amount whenever the package or discount changes (staff can still edit it).
  useEffect(() => {
    if (quote) form.setValue("amountTaka", totalPaisa / 100, { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the inputs of the total change
  }, [packageId, discountTaka]);

  return (
    <div className="flex flex-col gap-4">
      <Field
        id={`${idPrefix}-package`}
        label={t("package")}
        error={errorText(errors.packageId?.message)}
      >
        <NativeSelect {...form.register("packageId")}>
          <option value="">{t("choosePackage")}</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatTaka(p.price_paisa)}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          id={`${idPrefix}-amount`}
          label={t("amount")}
          error={errorText(errors.amountTaka?.message)}
        >
          <Input inputMode="decimal" className="num" {...form.register("amountTaka")} />
        </Field>
        <Field
          id={`${idPrefix}-discount`}
          label={t("discount")}
          error={errorText(errors.discountTaka?.message)}
        >
          <Input inputMode="decimal" className="num" {...form.register("discountTaka")} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t("method")}</legend>
        <div
          role="radiogroup"
          aria-label={t("method")}
          className="grid grid-cols-3 gap-2 sm:grid-cols-5"
        >
          {PAYMENT_METHODS.map((m) => {
            const selected = method === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  form.setValue("method", m as PaymentMethod, { shouldValidate: true })
                }
                className={cn(
                  "h-11 cursor-pointer rounded-sm text-sm",
                  selected
                    ? "border-2 border-accent bg-surface-2 font-semibold"
                    : "border border-border bg-bg hover:bg-surface-2",
                )}
              >
                {tm(m)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {needsTransactionId(method as PaymentMethod) ? (
        <Field
          id={`${idPrefix}-txn`}
          label={t("transactionId", { method: tm(method as PaymentMethod) })}
          hint={t("pendingNote")}
          error={errorText(errors.transactionId?.message)}
        >
          <Input
            className="num uppercase"
            autoComplete="off"
            autoCapitalize="characters"
            {...form.register("transactionId")}
          />
        </Field>
      ) : null}

      {quote ? (
        <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">{t("newExpiry")}</span>
            <span className="num font-semibold">{formatDateShort(quote.endDate)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">{t("total")}</span>
            <span className="num text-2xl font-bold text-accent-text">
              {formatTaka(totalPaisa)}
            </span>
          </div>
          {quote.admissionPaisa > 0 ? (
            <p className="text-xs text-muted">
              {t("admissionIncluded", { fee: formatTaka(quote.admissionPaisa) })}
            </p>
          ) : null}
          {previousDuePaisa > 0 ? (
            <p className="text-xs text-warning">
              {t("previousDue", { due: formatTaka(previousDuePaisa) })}
            </p>
          ) : null}
          {leftDuePaisa > 0 ? (
            <p className="text-xs font-semibold text-warning">
              {t("partialNote", { due: formatTaka(leftDuePaisa) })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
