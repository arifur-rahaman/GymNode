"use client";

import { useState, useTransition } from "react";
import { Box, Pencil, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { formatTaka, packageFormSchema, type PackageFormInput } from "@gymnode/core";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useErrorText } from "@/lib/use-error-text";
import { deletePackage, savePackage } from "./actions";

type Pkg = {
  id: string;
  name: string;
  duration_days: number;
  price_paisa: number;
  admission_fee_paisa: number;
  is_active: boolean;
};

export function PackagesManager({ packages, canEdit }: { packages: Pkg[]; canEdit: boolean }) {
  const t = useTranslations("packages");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [editing, setEditing] = useState<Pkg | "new" | null>(null);
  const [deleting, setDeleting] = useState<Pkg | null>(null);
  const [pending, startTransition] = useTransition();

  const columns: Column<Pkg>[] = [
    {
      key: "name",
      header: t("colName"),
      width: "2fr",
      primary: true,
      cell: (p) => <span className="font-semibold">{p.name}</span>,
    },
    {
      key: "dur",
      header: t("colDuration"),
      cell: (p) => <span className="num">{tc("days", { count: String(p.duration_days) })}</span>,
    },
    {
      key: "price",
      header: t("colPrice"),
      cell: (p) => <span className="num font-semibold">{formatTaka(p.price_paisa)}</span>,
    },
    {
      key: "adm",
      header: t("colAdmission"),
      cell: (p) => <span className="num text-muted">{formatTaka(p.admission_fee_paisa)}</span>,
    },
    {
      key: "status",
      header: t("colStatus"),
      cell: (p) => (
        <Badge tone={p.is_active ? "green" : "gray"}>
          {p.is_active ? t("active") : t("inactive")}
        </Badge>
      ),
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: t("colActions"),
            width: "110px",
            align: "end" as const,
            mobileFooter: true,
            cell: (p: Pkg) => (
              <span className="flex justify-end gap-2">
                <Button
                  size="icon-sm"
                  variant="secondary"
                  aria-label={`${tc("edit")} ${p.name}`}
                  onClick={() => setEditing(p)}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="danger"
                  aria-label={`${tc("delete")} ${p.name}`}
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 />
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
        {canEdit ? <Button onClick={() => setEditing("new")}>{t("add")}</Button> : null}
      </header>
      {!canEdit ? <p className="text-sm text-muted">{t("readOnly")}</p> : null}

      {packages.length === 0 ? (
        <EmptyState
          icon={<Box />}
          message={t("empty")}
          action={canEdit ? <Button onClick={() => setEditing("new")}>{t("add")}</Button> : null}
        />
      ) : (
        <ResponsiveTable
          caption={t("title")}
          columns={columns}
          rows={packages}
          rowKey={(p) => p.id}
        />
      )}

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
          <SheetTitle>{editing === "new" ? t("addTitle") : t("editTitle")}</SheetTitle>
          {editing ? (
            <PackageForm
              key={editing === "new" ? "new" : editing.id}
              pkg={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <SheetContent closeLabel={tc("close")}>
          <SheetTitle>
            {tc("delete")}: {deleting?.name}
          </SheetTitle>
          <SheetDescription className="mt-2">{t("deleteConfirm")}</SheetDescription>
          <Button
            variant="danger"
            size="lg"
            className="mt-6"
            disabled={pending}
            onClick={() =>
              deleting &&
              startTransition(async () => {
                const res = await deletePackage(deleting.id);
                if (res.ok) {
                  toast.success(t("deleted"));
                  setDeleting(null);
                } else toast.error(errorText(res.formError));
              })
            }
          >
            {tc("delete")}
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PackageForm({ pkg, onDone }: { pkg: Pkg | null; onDone: () => void }) {
  const t = useTranslations("packages");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<PackageFormInput>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: pkg
      ? {
          name: pkg.name,
          durationDays: pkg.duration_days,
          priceTaka: pkg.price_paisa / 100,
          admissionFeeTaka: pkg.admission_fee_paisa / 100,
          isActive: pkg.is_active,
        }
      : { name: "", durationDays: 30, priceTaka: 0, admissionFeeTaka: 0, isActive: true },
  });
  const { errors } = form.formState;
  const isActive = useWatch({ control: form.control, name: "isActive" });

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await savePackage(pkg?.id ?? null, form.getValues());
      if (res.ok) {
        toast.success(t("saved"));
        onDone();
      } else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {})) {
          form.setError(field as keyof PackageFormInput, { message: code });
        }
        setFormError(res.formError ?? null);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
      <FormError message={errorText(formError)} />
      <Field id="pk-name" label={t("name")} error={errorText(errors.name?.message)}>
        <Input {...form.register("name")} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field id="pk-days" label={t("duration")} error={errorText(errors.durationDays?.message)}>
          <Input inputMode="numeric" className="num" {...form.register("durationDays")} />
        </Field>
        <Field id="pk-price" label={t("price")} error={errorText(errors.priceTaka?.message)}>
          <Input inputMode="decimal" className="num" {...form.register("priceTaka")} />
        </Field>
        <Field
          id="pk-adm"
          label={t("admission")}
          error={errorText(errors.admissionFeeTaka?.message)}
        >
          <Input inputMode="decimal" className="num" {...form.register("admissionFeeTaka")} />
        </Field>
      </div>
      <label
        htmlFor="pk-active"
        className="flex min-h-14 cursor-pointer items-center justify-between gap-4"
      >
        <span className="flex flex-col">
          <span className="font-semibold">{t("active")}</span>
          <span className="text-[13px] text-muted">{t("activeHint")}</span>
        </span>
        <Switch
          id="pk-active"
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
