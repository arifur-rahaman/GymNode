"use client";

import { useState, useTransition } from "react";
import { Check, Pencil } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  formatTaka,
  PLAN_FEATURES,
  planSchema,
  type PlanFeature,
  type PlanInput,
} from "@gymnode/core";
import { savePlan } from "@/app/admin/actions";
import { FormError } from "@/components/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useErrorText } from "@/lib/use-error-text";
import { cn } from "@/lib/utils";

export type PlanRow = {
  id: string;
  name: string;
  nameEn: string;
  pricePaisa: number | null;
  billingPeriod: "monthly" | "yearly";
  maxMembers: number | null;
  maxBranches: number | null;
  maxDevices: number | null;
  features: string[];
  isActive: boolean;
  gyms: number;
};

/** SA-Billing.dc.html plan cards. Prices stay "[দাম]" until the founder sets them. */
export function PlansManager({ plans, canEdit }: { plans: PlanRow[]; canEdit: boolean }) {
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const tf = useTranslations("planFeatures");
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);

  const limit = (n: number | null, key: "members" | "branches" | "devices") =>
    n === null ? t(`unlimited_${key}`) : t(`limit_${key}`, { count: String(n) });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        {canEdit ? <Button onClick={() => setEditing("new")}>{t("add")}</Button> : null}
      </header>

      <div className="grid gap-4 md:grid-cols-2 desk:grid-cols-3">
        {plans.map((p, i) => (
          <Card
            key={p.id}
            className={cn(
              "flex flex-col gap-3",
              i === 1 && "border-2 border-accent",
              !p.isActive && "opacity-70",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{p.name}</h2>
                <p className="text-[13px] text-muted">
                  {t("gymsCount", { count: String(p.gyms) })}
                </p>
              </div>
              {!p.isActive ? <Badge tone="gray">{t("inactive")}</Badge> : null}
            </div>
            <p className="num text-2xl font-bold">
              {p.pricePaisa !== null ? formatTaka(p.pricePaisa) : t("priceTbd")}{" "}
              <span className="text-sm font-normal text-muted">
                / {t(`period_${p.billingPeriod}`)}
              </span>
            </p>
            <p className="text-sm text-muted">
              {limit(p.maxMembers, "members")} · {limit(p.maxBranches, "branches")} ·{" "}
              {limit(p.maxDevices, "devices")}
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-success" aria-hidden />
                  {tf.has(f) ? tf(f) : f}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <Button variant="secondary" className="mt-auto" onClick={() => setEditing(p)}>
                <Pencil /> {t("edit")}
              </Button>
            ) : null}
          </Card>
        ))}
      </div>
      <p className="text-[13px] text-muted">{t("limitsNote")}</p>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
          <SheetTitle>{editing === "new" ? t("add") : t("edit")}</SheetTitle>
          {editing ? (
            <PlanForm
              key={editing === "new" ? "new" : editing.id}
              plan={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PlanForm({ plan, onDone }: { plan: PlanRow | null; onDone: () => void }) {
  const t = useTranslations("plans");
  const tf = useTranslations("planFeatures");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const blank = (n: number | null | undefined) => (n === null || n === undefined ? "" : n);
  const form = useForm<PlanInput>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: plan?.name ?? "",
      nameEn: plan?.nameEn ?? "",
      priceTaka:
        plan?.pricePaisa !== null && plan?.pricePaisa !== undefined ? plan.pricePaisa / 100 : "",
      billingPeriod: plan?.billingPeriod ?? "monthly",
      maxMembers: blank(plan?.maxMembers),
      maxBranches: blank(plan?.maxBranches),
      maxDevices: blank(plan?.maxDevices),
      features: (plan?.features ?? []).filter((f): f is PlanFeature =>
        (PLAN_FEATURES as readonly string[]).includes(f),
      ),
      isActive: plan?.isActive ?? true,
    },
  });
  const [features, isActive] = useWatch({ control: form.control, name: ["features", "isActive"] });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await savePlan(plan?.id ?? null, form.getValues());
      if (res.ok) {
        toast.success(t("saved"));
        onDone();
      } else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as keyof PlanInput, { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="pl-name" label={t("name")} error={errorText(errors.name?.message)}>
          <Input {...form.register("name")} />
        </Field>
        <Field id="pl-name-en" label={t("nameEn")} error={errorText(errors.nameEn?.message)}>
          <Input {...form.register("nameEn")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="pl-price"
          label={t("price")}
          hint={t("priceHint")}
          error={errorText(errors.priceTaka?.message)}
        >
          <Input inputMode="decimal" className="num" {...form.register("priceTaka")} />
        </Field>
        <Field id="pl-period" label={t("period")}>
          <NativeSelect {...form.register("billingPeriod")}>
            <option value="monthly">{t("period_monthly")}</option>
            <option value="yearly">{t("period_yearly")}</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field
          id="pl-members"
          label={t("maxMembers")}
          error={errorText(errors.maxMembers?.message)}
        >
          <Input inputMode="numeric" className="num" {...form.register("maxMembers")} />
        </Field>
        <Field
          id="pl-branches"
          label={t("maxBranches")}
          error={errorText(errors.maxBranches?.message)}
        >
          <Input inputMode="numeric" className="num" {...form.register("maxBranches")} />
        </Field>
        <Field
          id="pl-devices"
          label={t("maxDevices")}
          error={errorText(errors.maxDevices?.message)}
        >
          <Input inputMode="numeric" className="num" {...form.register("maxDevices")} />
        </Field>
      </div>
      <p className="-mt-2 text-[13px] text-muted">{t("emptyUnlimited")}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{t("features")}</legend>
        {PLAN_FEATURES.map((f) => (
          <label key={f} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
            <Checkbox
              checked={features.includes(f)}
              onChange={(e) =>
                form.setValue(
                  "features",
                  e.target.checked ? [...features, f] : features.filter((x) => x !== f),
                )
              }
            />
            {tf(f)}
          </label>
        ))}
      </fieldset>
      <label htmlFor="pl-active" className="flex cursor-pointer items-center justify-between gap-4">
        <span className="font-semibold">{t("active")}</span>
        <Switch
          id="pl-active"
          checked={isActive}
          onCheckedChange={(v) => form.setValue("isActive", v)}
        />
      </label>
      <Button type="submit" size="lg" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
