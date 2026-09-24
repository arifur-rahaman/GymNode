"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { loginSchema, type LoginInput } from "@gymnode/core";
import { PasswordInput } from "@/components/auth/password-input";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/lib/use-error-text";
import { signIn } from "../actions";

export function LoginForm({
  next,
  initialError,
}: {
  next: string | null;
  initialError: string | null;
}) {
  const t = useTranslations("auth");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(initialError);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signIn(values, next);
      if (result && !result.ok) setFormError(result.formError ?? "unknown");
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field id="identifier" label={t("identifier")} error={errorText(errors.identifier?.message)}>
        <Input
          autoComplete="username"
          inputMode="email"
          placeholder={t("identifierPlaceholder")}
          {...form.register("identifier")}
        />
      </Field>
      <Field id="password" label={t("password")} error={errorText(errors.password?.message)}>
        <PasswordInput autoComplete="current-password" {...form.register("password")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("loggingIn") : t("login")}
      </Button>
      <div className="flex flex-col gap-2 text-sm">
        <Link
          href="/forgot-password"
          className="text-accent-text underline-offset-4 hover:underline"
        >
          {t("forgot")}
        </Link>
        <p className="text-muted">{t("staffForgotHint")}</p>
        <p className="text-muted">
          {t("noAccount")}{" "}
          <Link
            href="/signup"
            className="font-semibold text-accent-text underline-offset-4 hover:underline"
          >
            {t("createAccount")}
          </Link>
        </p>
      </div>
    </form>
  );
}
