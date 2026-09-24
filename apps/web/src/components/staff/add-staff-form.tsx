"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { STAFF_ROLES, staffSchema, type StaffInput } from "@gymnode/core";
import { createStaff } from "@/app/app/staff/actions";
import { PasswordInput } from "@/components/auth/password-input";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useErrorText } from "@/lib/use-error-text";

/** Name + phone + role + first password. Used in onboarding and on the staff page. */
export function AddStaffForm({
  gymId,
  allowedRoles = STAFF_ROLES,
  onDone,
}: {
  gymId: string;
  allowedRoles?: readonly (typeof STAFF_ROLES)[number][];
  onDone?: () => void;
}) {
  const t = useTranslations("staff");
  const tr = useTranslations("roles");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<StaffInput>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      role: allowedRoles.includes("reception") ? "reception" : allowedRoles[0],
      password: "",
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await createStaff(gymId, values);
      if (result.ok) {
        toast.success(t("added", { name: result.data?.name ?? values.fullName }));
        form.reset({ ...values, fullName: "", phone: "", password: "" });
        onDone?.();
        return;
      }
      for (const [field, code] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof StaffInput, { message: code });
      }
      setFormError(result.formError ?? null);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field id="staff-name" label={t("fullName")} error={errorText(errors.fullName?.message)}>
        <Input autoComplete="off" {...form.register("fullName")} />
      </Field>
      <Field id="staff-phone" label={t("phone")} error={errorText(errors.phone?.message)}>
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="off"
          className="num"
          placeholder="01712345678"
          {...form.register("phone")}
        />
      </Field>
      <Field id="staff-role" label={t("role")} error={errorText(errors.role?.message)}>
        <NativeSelect {...form.register("role")}>
          {allowedRoles.map((r) => (
            <option key={r} value={r}>
              {tr(r)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        id="staff-password"
        label={t("tempPassword")}
        hint={t("tempPasswordHint")}
        error={errorText(errors.password?.message)}
      >
        <PasswordInput autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
