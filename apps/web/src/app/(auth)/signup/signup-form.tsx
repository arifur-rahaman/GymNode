"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { signUpSchema, type SignUpInput } from "@gymnode/core";
import { PasswordInput } from "@/components/auth/password-input";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/lib/use-error-text";
import { signUp } from "../actions";

export function SignUpForm() {
  const t = useTranslations("auth");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signUp(values);
      if (!result) return;
      if (result.ok) setSentTo(result.data?.email ?? values.email);
      else setFormError(result.formError ?? "unknown");
    });
  });

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <MailCheck className="size-10 text-accent-text" aria-hidden />
        <h2 className="text-[17px] font-bold">{t("checkEmailTitle")}</h2>
        <p className="text-muted">{t("checkEmailBody", { email: sentTo })}</p>
        <Link href="/login" className="text-sm text-accent-text underline-offset-4 hover:underline">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field id="fullName" label={t("fullName")} error={errorText(errors.fullName?.message)}>
        <Input autoComplete="name" {...form.register("fullName")} />
      </Field>
      <Field id="email" label={t("email")} error={errorText(errors.email?.message)}>
        <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
      </Field>
      <Field id="password" label={t("newPassword")} error={errorText(errors.password?.message)}>
        <PasswordInput autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("signingUp") : t("signup")}
      </Button>
      <p className="text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link
          href="/login"
          className="font-semibold text-accent-text underline-offset-4 hover:underline"
        >
          {t("login")}
        </Link>
      </p>
    </form>
  );
}
