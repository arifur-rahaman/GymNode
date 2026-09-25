"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { platformSettingsSchema, type PlatformSettingsInput } from "@gymnode/core";
import { saveSettings } from "@/app/admin/actions";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/lib/use-error-text";

export function SettingsForm({ trialDays, graceDays }: { trialDays: number; graceDays: number }) {
  const t = useTranslations("platformSettings");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<PlatformSettingsInput>({
    resolver: zodResolver(platformSettingsSchema),
    defaultValues: { trialDays, graceDays },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await saveSettings(form.getValues());
      if (res.ok) toast.success(t("saved"));
      else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as keyof PlatformSettingsInput, { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={errorText(formError)} />
        <Field
          id="ps-trial"
          label={t("trialDays")}
          hint={t("trialDaysHint")}
          error={errorText(errors.trialDays?.message)}
        >
          <Input inputMode="numeric" className="num" {...form.register("trialDays")} />
        </Field>
        <Field
          id="ps-grace"
          label={t("graceDays")}
          hint={t("graceDaysHint")}
          error={errorText(errors.graceDays?.message)}
        >
          <Input inputMode="numeric" className="num" {...form.register("graceDays")} />
        </Field>
        <Button type="submit" disabled={pending}>
          {tc("save")}
        </Button>
      </form>
    </Card>
  );
}
