"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { emailOnlySchema } from "@gymnode/core";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/lib/use-error-text";
import { requestPasswordReset } from "../actions";

export function ForgotForm() {
  const t = useTranslations("auth");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const form = useForm<{ email: string }>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      if (result.ok) setSent(true);
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      {sent ? (
        <p role="status" className="rounded-md bg-surface-2 p-4 text-[15px]">
          {t("resetSent")}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field
            id="email"
            label={t("email")}
            error={errorText(form.formState.errors.email?.message)}
          >
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              {...form.register("email")}
            />
          </Field>
          <Button type="submit" size="lg" disabled={pending}>
            {t("sendLink")}
          </Button>
        </form>
      )}
      <p className="text-sm text-muted">{t("staffForgotHint")}</p>
      <Link href="/login" className="text-sm text-accent-text underline-offset-4 hover:underline">
        {t("backToLogin")}
      </Link>
    </div>
  );
}
