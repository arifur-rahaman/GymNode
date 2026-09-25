"use client";

import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { useForm, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  addDays,
  extendTrialSchema,
  formatTaka,
  gymPlanSchema,
  gymStatusSchema,
  invoiceSchema,
  supportSessionSchema,
  type ExtendTrialInput,
  type GymPlanInput,
  type GymStatusInput,
  type InvoiceInput,
  type IsoDate,
  type SupportSessionInput,
} from "@gymnode/core";
import {
  createInvoice,
  extendTrial,
  setGymPlan,
  setGymStatus,
  startSupport,
} from "@/app/admin/actions";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { ActionResult } from "@/lib/forms";
import { useErrorText } from "@/lib/use-error-text";

type Gym = {
  id: string;
  name: string;
  rawStatus: string;
  planId: string | null;
  priceOverride: number | null;
  monthlyPrice: number | null;
};

/** Runs an action and maps its errors onto a react-hook-form form. */
function useAction<T extends Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the resolver's output type varies per form
  form: UseFormReturn<T, any, any>,
  run: (values: T) => Promise<ActionResult<unknown>>,
  success: string,
  onDone?: () => void,
) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await run(form.getValues());
      if (res.ok) {
        toast.success(success);
        onDone?.();
      } else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as Parameters<typeof form.setError>[0], { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });
  return { pending, formError, onSubmit };
}

export function GymActions({
  gym,
  plans,
  isSuper,
  today,
}: {
  gym: Gym;
  plans: { id: string; name: string; pricePaisa: number | null }[];
  isSuper: boolean;
  today: IsoDate;
}) {
  const t = useTranslations("admin");
  const [statusDialog, setStatusDialog] = useState<"active" | "suspended" | "cancelled" | null>(
    null,
  );
  const [supportOpen, setSupportOpen] = useState(false);
  const tc = useTranslations("common");

  return (
    <div className="flex flex-col gap-4 self-start">
      <Card className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">{t("supportModeTitle")}</h2>
        <p className="text-sm text-muted">{t("supportModeHint")}</p>
        <Button onClick={() => setSupportOpen(true)}>
          <Eye /> {t("supportModeOpen")}
        </Button>
      </Card>

      {isSuper ? (
        <>
          <PlanCard gym={gym} plans={plans} />
          <Card className="flex flex-col gap-3">
            <h2 className="text-[17px] font-bold">{t("statusTitle")}</h2>
            <div className="flex flex-wrap gap-2">
              {gym.rawStatus !== "active" ? (
                <Button size="sm" onClick={() => setStatusDialog("active")}>
                  {t("activate")}
                </Button>
              ) : null}
              {gym.rawStatus !== "suspended" ? (
                <Button size="sm" variant="secondary" onClick={() => setStatusDialog("suspended")}>
                  {t("suspend")}
                </Button>
              ) : null}
              {gym.rawStatus !== "cancelled" ? (
                <Button size="sm" variant="danger" onClick={() => setStatusDialog("cancelled")}>
                  {t("cancelGym")}
                </Button>
              ) : null}
            </div>
            <TrialForm gymId={gym.id} />
          </Card>
          <InvoiceCard gym={gym} today={today} />
        </>
      ) : (
        <p className="text-sm text-muted">{t("supportRoleNote")}</p>
      )}

      <Sheet open={supportOpen} onOpenChange={setSupportOpen}>
        <SheetContent closeLabel={tc("close")}>
          <SheetTitle>{t("supportModeOpen")}</SheetTitle>
          <SheetDescription className="mt-1">
            {t("supportModeWarning", { gym: gym.name })}
          </SheetDescription>
          <SupportForm gymId={gym.id} />
        </SheetContent>
      </Sheet>

      <Sheet open={statusDialog !== null} onOpenChange={(o) => !o && setStatusDialog(null)}>
        <SheetContent closeLabel={tc("close")}>
          <SheetTitle>{statusDialog ? t(`statusDialog_${statusDialog}`) : ""}</SheetTitle>
          <SheetDescription className="mt-1">
            {statusDialog ? t(`statusHint_${statusDialog}`) : ""}
          </SheetDescription>
          {statusDialog ? (
            <StatusForm
              key={statusDialog}
              gymId={gym.id}
              status={statusDialog}
              onDone={() => setStatusDialog(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SupportForm({ gymId }: { gymId: string }) {
  const t = useTranslations("admin");
  const errorText = useErrorText();
  const form = useForm<SupportSessionInput>({
    resolver: zodResolver(supportSessionSchema),
    defaultValues: { reason: "", minutes: 30 },
  });
  const { pending, formError, onSubmit } = useAction(
    form,
    (v) => startSupport(gymId, v),
    t("supportStarted"),
  );
  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field
        id="sup-reason"
        label={t("supportReason")}
        error={errorText(form.formState.errors.reason?.message)}
      >
        <Input autoFocus placeholder={t("supportReasonPlaceholder")} {...form.register("reason")} />
      </Field>
      <Field id="sup-min" label={t("supportMinutes")}>
        <NativeSelect {...form.register("minutes")}>
          {[15, 30, 60, 120].map((m) => (
            <option key={m} value={m}>
              {t("minutes", { count: String(m) })}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {t("supportModeOpen")}
      </Button>
    </form>
  );
}

function PlanCard({
  gym,
  plans,
}: {
  gym: Gym;
  plans: { id: string; name: string; pricePaisa: number | null }[];
}) {
  const t = useTranslations("admin");
  const errorText = useErrorText();
  const form = useForm<GymPlanInput>({
    resolver: zodResolver(gymPlanSchema),
    defaultValues: {
      planId: gym.planId ?? "",
      priceTaka: gym.priceOverride !== null ? gym.priceOverride / 100 : "",
    },
  });
  const { pending, formError, onSubmit } = useAction(
    form,
    (v) => setGymPlan(gym.id, v),
    t("planSaved"),
  );
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">{t("planTitle")}</h2>
        <FormError message={errorText(formError)} />
        <Field id="gp-plan" label={t("colPlan")}>
          <NativeSelect {...form.register("planId")}>
            <option value="">{t("noPlan")}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.pricePaisa !== null ? formatTaka(p.pricePaisa) : t("priceTbd")}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          id="gp-price"
          label={t("priceOverride")}
          hint={t("priceOverrideHint")}
          error={errorText(form.formState.errors.priceTaka?.message)}
        >
          <Input inputMode="decimal" className="num" {...form.register("priceTaka")} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("savePlan")}
        </Button>
      </form>
    </Card>
  );
}

function StatusForm({
  gymId,
  status,
  onDone,
}: {
  gymId: string;
  status: "active" | "suspended" | "cancelled";
  onDone: () => void;
}) {
  const t = useTranslations("admin");
  const errorText = useErrorText();
  const form = useForm<GymStatusInput>({
    resolver: zodResolver(gymStatusSchema),
    defaultValues: { status, reason: "" },
  });
  const { pending, formError, onSubmit } = useAction(
    form,
    (v) => setGymStatus(gymId, v),
    t("statusSaved"),
    onDone,
  );
  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field
        id="gs-reason"
        label={t("reason")}
        error={errorText(form.formState.errors.reason?.message)}
      >
        <Input autoFocus {...form.register("reason")} />
      </Field>
      <Button
        type="submit"
        size="lg"
        variant={status === "active" ? "primary" : "danger"}
        disabled={pending}
      >
        {t(`statusDialog_${status}`)}
      </Button>
    </form>
  );
}

function TrialForm({ gymId }: { gymId: string }) {
  const t = useTranslations("admin");
  const errorText = useErrorText();
  const form = useForm<ExtendTrialInput>({
    resolver: zodResolver(extendTrialSchema),
    defaultValues: { days: 7 },
  });
  const { pending, formError, onSubmit } = useAction(
    form,
    (v) => extendTrial(gymId, v),
    t("trialExtended"),
  );
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-2 border-t border-border pt-3"
    >
      <FormError message={errorText(formError)} />
      <div className="flex items-end gap-2">
        <Field
          id="tr-days"
          label={t("extendTrial")}
          error={errorText(form.formState.errors.days?.message)}
          className="flex-1"
        >
          <Input inputMode="numeric" className="num" {...form.register("days")} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("extend")}
        </Button>
      </div>
    </form>
  );
}

function InvoiceCard({ gym, today }: { gym: Gym; today: IsoDate }) {
  const tb = useTranslations("billing");
  const errorText = useErrorText();
  const form = useForm<InvoiceInput, unknown, z.output<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      amountTaka: gym.monthlyPrice !== null ? gym.monthlyPrice / 100 : ("" as unknown as number),
      dueDate: addDays(today, 7),
      periodMonth: today.slice(0, 7),
      note: "",
    },
  });
  const { pending, formError, onSubmit } = useAction(
    form,
    (v) => createInvoice(gym.id, v),
    tb("invoiceCreated"),
    () => form.reset(),
  );
  const { errors } = form.formState;
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">{tb("newInvoice")}</h2>
        <FormError message={errorText(formError)} />
        <div className="grid grid-cols-2 gap-3">
          <Field id="inv-amount" label={tb("amount")} error={errorText(errors.amountTaka?.message)}>
            <Input inputMode="decimal" className="num" {...form.register("amountTaka")} />
          </Field>
          <Field id="inv-month" label={tb("month")} error={errorText(errors.periodMonth?.message)}>
            <Input type="month" className="num" {...form.register("periodMonth")} />
          </Field>
        </div>
        <Field id="inv-due" label={tb("dueDate")} error={errorText(errors.dueDate?.message)}>
          <Input type="date" className="num" {...form.register("dueDate")} />
        </Field>
        <Field id="inv-note" label={tb("note")} error={errorText(errors.note?.message)}>
          <Input {...form.register("note")} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>
          {tb("createInvoice")}
        </Button>
      </form>
    </Card>
  );
}
