"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { packagesSchema, type PackageInput } from "@gymnode/core";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/lib/use-error-text";
import { savePackages } from "./actions";

type FormValues = { packages: PackageInput[] };

export function PackagesStep({ gymId, existingCount }: { gymId: string; existingCount: number }) {
  const t = useTranslations("onboarding");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(packagesSchema),
    // Common Bangladeshi gym packages, prices from the designs. The owner edits them.
    defaultValues: {
      packages: [
        { name: t("defaultMonthly"), durationDays: 30, priceTaka: 1500, admissionFeeTaka: 1000 },
        { name: t("default3m"), durationDays: 90, priceTaka: 4000, admissionFeeTaka: 1000 },
        { name: t("default6m"), durationDays: 180, priceTaka: 7500, admissionFeeTaka: 0 },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "packages" });
  const errors = form.formState.errors.packages;

  if (existingCount > 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md bg-surface-2 p-4">{t("packagesHint")}</p>
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/onboarding?step=staff">{t("next")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await savePackages(gymId, values.packages);
      if (result && !result.ok) setFormError(result.formError ?? "unknown");
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <h2 className="text-[17px] font-bold">{t("packagesTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("packagesHint")}</p>
      </div>
      <FormError message={errorText(formError)} />
      <ul className="flex flex-col gap-3">
        {fields.map((field, i) => (
          <li key={field.id} className="rounded-lg border border-border bg-bg p-4">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-start">
              <Field
                id={`pkg-${i}-name`}
                label={t("packageName")}
                error={errorText(errors?.[i]?.name?.message)}
              >
                <Input {...form.register(`packages.${i}.name`)} />
              </Field>
              <Field
                id={`pkg-${i}-days`}
                label={t("durationDays")}
                error={errorText(errors?.[i]?.durationDays?.message)}
              >
                <Input
                  inputMode="numeric"
                  className="num"
                  {...form.register(`packages.${i}.durationDays`)}
                />
              </Field>
              <Field
                id={`pkg-${i}-price`}
                label={t("price")}
                error={errorText(errors?.[i]?.priceTaka?.message)}
              >
                <Input
                  inputMode="decimal"
                  className="num"
                  {...form.register(`packages.${i}.priceTaka`)}
                />
              </Field>
              <Field
                id={`pkg-${i}-fee`}
                label={t("admissionFee")}
                error={errorText(errors?.[i]?.admissionFeeTaka?.message)}
              >
                <Input
                  inputMode="decimal"
                  className="num"
                  {...form.register(`packages.${i}.admissionFeeTaka`)}
                />
              </Field>
              <Button
                type="button"
                variant="danger"
                size="icon"
                aria-label={t("removePackage")}
                disabled={fields.length === 1}
                onClick={() => remove(i)}
                className="sm:mt-7"
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {fields.length < 10 ? (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => append({ name: "", durationDays: 30, priceTaka: 0, admissionFeeTaka: 0 })}
        >
          {t("addPackage")}
        </Button>
      ) : null}
      <div className="flex flex-wrap justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href="/onboarding?step=logo">{t("back")}</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {t("savePackages")}
        </Button>
      </div>
    </form>
  );
}
