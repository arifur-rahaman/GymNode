"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { gymSchema, type GymInput } from "@gymnode/core";
import type { z } from "zod";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/lib/use-error-text";
import { createGym } from "./actions";

export function GymStep() {
  const t = useTranslations("onboarding");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<GymInput, unknown, z.output<typeof gymSchema>>({
    resolver: zodResolver(gymSchema),
    defaultValues: {
      name: "",
      codePrefix: "",
      city: "ঢাকা",
      phone: "",
      address: "",
      branchName: "",
      branchAddress: "",
    },
  });
  const { errors } = form.formState;
  const prefix = (useWatch({ control: form.control, name: "codePrefix" }) || "PH")
    .toUpperCase()
    .slice(0, 4);

  // The server validates again, so it receives the raw typed values, not the parsed ones.
  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const result = await createGym(form.getValues());
      if (!result || result.ok) return;
      for (const [field, code] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof GymInput, { message: code });
      }
      setFormError(result.formError ?? null);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field id="gym-name" label={t("gymName")} error={errorText(errors.name?.message)}>
        <Input
          placeholder={t("gymNamePlaceholder")}
          autoComplete="organization"
          {...form.register("name")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="gym-prefix"
          label={t("codePrefix")}
          hint={t("codePrefixHint", { example: `${prefix}-0001` })}
          error={errorText(errors.codePrefix?.message)}
        >
          <Input
            className="num uppercase"
            maxLength={4}
            autoCapitalize="characters"
            placeholder="PH"
            {...form.register("codePrefix")}
          />
        </Field>
        <Field id="gym-city" label={t("city")} error={errorText(errors.city?.message)}>
          <Input autoComplete="address-level2" {...form.register("city")} />
        </Field>
      </div>
      <Field id="gym-phone" label={t("phone")} error={errorText(errors.phone?.message)}>
        <Input
          type="tel"
          inputMode="tel"
          className="num"
          placeholder="01712345678"
          {...form.register("phone")}
        />
      </Field>
      <Field id="gym-address" label={t("address")} error={errorText(errors.address?.message)}>
        <Input autoComplete="street-address" {...form.register("address")} />
      </Field>
      <hr className="border-border" />
      <Field id="branch-name" label={t("branchName")} error={errorText(errors.branchName?.message)}>
        <Input placeholder={t("branchNamePlaceholder")} {...form.register("branchName")} />
      </Field>
      <Field
        id="branch-address"
        label={t("branchAddress")}
        error={errorText(errors.branchAddress?.message)}
      >
        <Input {...form.register("branchAddress")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("creating") : t("createGym")}
      </Button>
    </form>
  );
}
