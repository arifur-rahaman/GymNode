"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import {
  GENDERS,
  selfRegistrationSchema,
  todayInDhaka,
  type SelfRegistrationInput,
} from "@gymnode/core";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useErrorText } from "@/lib/use-error-text";
import { submitSelfRegistration } from "./actions";

export function JoinForm({ slug }: { slug: string }) {
  const t = useTranslations("join");
  const tf = useTranslations("memberForm");
  const tg = useTranslations("genders");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm<SelfRegistrationInput, unknown, z.output<typeof selfRegistrationSchema>>({
    resolver: zodResolver(selfRegistrationSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      gender: "",
      dob: "",
      address: "",
      emergencyName: "",
      emergencyPhone: "",
    },
  });
  const { errors } = form.formState;

  if (done) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <h2 className="text-[17px] font-bold">{t("doneTitle")}</h2>
        <p className="text-muted">{t("doneBody")}</p>
      </div>
    );
  }

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await submitSelfRegistration(slug, form.getValues());
      if (res.ok) setDone(true);
      else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {})) {
          form.setError(field as keyof SelfRegistrationInput, { message: code });
        }
        setFormError(res.formError ?? null);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field id="j-name" label={tf("fullName")} error={errorText(errors.fullName?.message)}>
        <Input autoComplete="name" {...form.register("fullName")} />
      </Field>
      <Field id="j-phone" label={tf("phone")} error={errorText(errors.phone?.message)}>
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="num"
          placeholder="01712345678"
          {...form.register("phone")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="j-gender" label={tf("gender")} error={errorText(errors.gender?.message)}>
          <NativeSelect {...form.register("gender")}>
            <option value="">{tf("chooseGender")}</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {tg(g)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="j-dob" label={tf("dob")} error={errorText(errors.dob?.message)}>
          <Input type="date" className="num" max={todayInDhaka()} {...form.register("dob")} />
        </Field>
      </div>
      <Field id="j-address" label={tf("address")} error={errorText(errors.address?.message)}>
        <Input autoComplete="street-address" {...form.register("address")} />
      </Field>
      <Field
        id="j-em-name"
        label={tf("emergencyName")}
        error={errorText(errors.emergencyName?.message)}
      >
        <Input {...form.register("emergencyName")} />
      </Field>
      <Field
        id="j-em-phone"
        label={tf("emergencyPhone")}
        error={errorText(errors.emergencyPhone?.message)}
      >
        <Input type="tel" inputMode="tel" className="num" {...form.register("emergencyPhone")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
