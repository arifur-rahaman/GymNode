"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { newPasswordSchema, type NewPasswordInput } from "@gymnode/core";
import { setNewPassword } from "@/app/(auth)/actions";
import { PasswordInput } from "@/components/auth/password-input";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useErrorText } from "@/lib/use-error-text";

export function NewPasswordForm() {
  const t = useTranslations("auth");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await setNewPassword(values);
      if (result && !result.ok) setFormError(result.formError ?? "unknown");
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field id="password" label={t("newPassword")} error={errorText(errors.password?.message)}>
        <PasswordInput autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field id="confirm" label={t("confirmPassword")} error={errorText(errors.confirm?.message)}>
        <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {t("savePassword")}
      </Button>
    </form>
  );
}
