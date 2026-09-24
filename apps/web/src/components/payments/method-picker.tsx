"use client";

import { useTranslations } from "next-intl";
import { PAYMENT_METHODS, type PaymentMethod } from "@gymnode/core";
import { cn } from "@/lib/utils";

/** Cash / bKash / Nagad / Rocket / Card chips (Payments.dc.html): selected = accent border. */
export function MethodPicker({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
}) {
  const t = useTranslations("payment");
  const tm = useTranslations("methods");
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{t("method")}</legend>
      <div
        role="radiogroup"
        aria-label={t("method")}
        className="grid grid-cols-3 gap-2 sm:grid-cols-5"
      >
        {PAYMENT_METHODS.map((m) => {
          const selected = value === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(m)}
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
  );
}
