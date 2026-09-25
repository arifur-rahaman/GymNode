"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  gymProfileSchema,
  ticketSchema,
  type GymProfileInput,
  type TicketInput,
} from "@gymnode/core";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useErrorText } from "@/lib/use-error-text";
import { openTicket, saveGymProfile } from "./actions";

export function GymProfileForm({ values, canEdit }: { values: GymProfileInput; canEdit: boolean }) {
  const t = useTranslations("gymSettings");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<GymProfileInput, unknown, z.output<typeof gymProfileSchema>>({
    resolver: zodResolver(gymProfileSchema),
    defaultValues: values,
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await saveGymProfile(form.getValues());
      if (res.ok) toast.success(t("saved"));
      else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as keyof GymProfileInput, { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });
  return (
    <Card className="max-w-2xl">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {!canEdit ? <p className="text-sm text-muted">{t("ownerOnly")}</p> : null}
        <FormError message={errorText(formError)} />
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
          <Field id="gs-name" label={t("gymName")} error={errorText(errors.name?.message)}>
            <Input {...form.register("name")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="gs-city" label={t("city")} error={errorText(errors.city?.message)}>
              <Input {...form.register("city")} />
            </Field>
            <Field id="gs-phone" label={t("phone")} error={errorText(errors.phone?.message)}>
              <Input inputMode="tel" className="num" {...form.register("phone")} />
            </Field>
          </div>
          <Field id="gs-address" label={t("address")} error={errorText(errors.address?.message)}>
            <Input {...form.register("address")} />
          </Field>
          <Field
            id="gs-target"
            label={t("monthlyTarget")}
            hint={t("monthlyTargetHint")}
            error={errorText(errors.monthlyTargetTaka?.message)}
          >
            <Input inputMode="decimal" className="num" {...form.register("monthlyTargetTaka")} />
          </Field>
          {canEdit ? (
            <Button type="submit" disabled={pending} className="self-start">
              {tc("save")}
            </Button>
          ) : null}
        </fieldset>
      </form>
    </Card>
  );
}

export function NewTicketForm() {
  const t = useTranslations("support");
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<TicketInput>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { subject: "", body: "", priority: "normal" },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await openTicket(form.getValues());
      if (res.ok && res.data) {
        toast.success(t("opened"));
        router.push(`/app/settings?tab=support&ticket=${res.data.id}`);
      } else if (!res.ok) {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as keyof TicketInput, { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });
  return (
    <Card className="self-start">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">{t("newTicket")}</h2>
        <p className="text-[13px] text-muted">{t("newTicketHint")}</p>
        <FormError message={errorText(formError)} />
        <Field id="tk-subject" label={t("subject")} error={errorText(errors.subject?.message)}>
          <Input {...form.register("subject")} />
        </Field>
        <Field id="tk-body" label={t("details")} error={errorText(errors.body?.message)}>
          <textarea
            rows={5}
            maxLength={2000}
            className="min-h-28 rounded-md border border-border bg-bg px-3.5 py-3 text-[15px] outline-none focus-visible:border-accent aria-invalid:border-danger"
            {...form.register("body")}
          />
        </Field>
        <Field id="tk-priority" label={t("colPriority")}>
          <NativeSelect {...form.register("priority")}>
            <option value="normal">{t("normal")}</option>
            <option value="urgent">{t("urgent")}</option>
          </NativeSelect>
        </Field>
        <Button type="submit" disabled={pending}>
          {t("send")}
        </Button>
      </form>
    </Card>
  );
}
