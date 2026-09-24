"use client";

import { useState, useTransition } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { staffPasswordResetSchema, type StaffRole } from "@gymnode/core";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { PasswordInput } from "@/components/auth/password-input";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { AddStaffForm } from "@/components/staff/add-staff-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useErrorText } from "@/lib/use-error-text";
import { resetStaffPassword, setStaffActive } from "./actions";

export type StaffRow = {
  id: string;
  name: string;
  role: "owner" | "manager" | "reception" | "trainer";
  isActive: boolean;
  isSelf: boolean;
  phone: string | null;
  mustChangePassword: boolean;
};

export function StaffManager({
  title,
  gymId,
  rows,
  allowedRoles,
}: {
  title: string;
  gymId: string;
  rows: StaffRow[];
  allowedRoles: StaffRole[];
}) {
  const t = useTranslations("staff");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [addOpen, setAddOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const manageable = (r: StaffRow) =>
    r.role !== "owner" && allowedRoles.includes(r.role as StaffRole);

  const columns: Column<StaffRow>[] = [
    {
      key: "name",
      header: t("colName"),
      width: "2fr",
      primary: true,
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-bold"
          >
            {r.name.charAt(0)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">
              {r.name}{" "}
              {r.isSelf ? <span className="font-normal text-muted">({t("you")})</span> : null}
            </span>
            {r.mustChangePassword ? (
              <span className="text-xs text-warning">{t("needsPasswordChange")}</span>
            ) : null}
          </span>
        </span>
      ),
    },
    {
      key: "role",
      header: t("colRole"),
      cell: (r) => <Badge tone={r.role === "owner" ? "blue" : "gray"}>{tr(r.role)}</Badge>,
    },
    {
      key: "phone",
      header: t("colPhone"),
      width: "1.3fr",
      cell: (r) => <span className="num text-muted">{r.phone ?? "—"}</span>,
    },
    {
      key: "status",
      header: t("colStatus"),
      cell: (r) => (
        <Badge tone={r.isActive ? "green" : "gray"}>
          {r.isActive ? t("active") : t("inactive")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: t("colActions"),
      width: "220px",
      align: "end",
      mobileFooter: true,
      cell: (r) =>
        manageable(r) ? (
          <span className="flex flex-wrap justify-end gap-2">
            <ResetPasswordButton row={r} />
            <Button
              size="sm"
              variant={r.isActive ? "danger" : "secondary"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await setStaffActive(r.id, !r.isActive);
                  if (!result.ok) toast.error(errorText(result.formError));
                })
              }
            >
              {r.isActive ? t("deactivate") : t("activate")}
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{title}</h1>
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger asChild>
            <Button>{t("add")}</Button>
          </SheetTrigger>
          <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
            <SheetTitle>{t("addTitle")}</SheetTitle>
            <div className="mt-5">
              <AddStaffForm
                gymId={gymId}
                allowedRoles={allowedRoles}
                onDone={() => setAddOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </header>
      {rows.filter((r) => r.role !== "owner").length === 0 ? (
        <EmptyState
          icon={<UserPlus />}
          message={t("empty")}
          action={<Button onClick={() => setAddOpen(true)}>{t("add")}</Button>}
        />
      ) : null}
      <ResponsiveTable caption={title} columns={columns} rows={rows} rowKey={(r) => r.id} />
    </>
  );
}

function ResetPasswordButton({ row }: { row: StaffRow }) {
  const t = useTranslations("staff");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<{ password: string }>({
    resolver: zodResolver(staffPasswordResetSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await resetStaffPassword(row.id, values);
      if (result.ok) {
        toast.success(t("resetDone"));
        form.reset();
        setOpen(false);
      } else setFormError(result.formError ?? null);
    });
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="secondary">
          <KeyRound /> {t("resetPassword")}
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={tc("close")}>
        <SheetTitle>{t("resetTitle", { name: row.name })}</SheetTitle>
        <SheetDescription className="mt-1">{t("tempPasswordHint")}</SheetDescription>
        <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
          <FormError message={errorText(formError)} />
          <Field
            id={`reset-${row.id}`}
            label={ta("newPassword")}
            error={errorText(form.formState.errors.password?.message)}
          >
            <PasswordInput autoComplete="new-password" {...form.register("password")} />
          </Field>
          <Button type="submit" size="lg" disabled={pending}>
            {ta("savePassword")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
