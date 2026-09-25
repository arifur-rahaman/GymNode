"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { formatDateShort, teamMemberSchema, type TeamMemberInput } from "@gymnode/core";
import { addTeamMember, removeTeamMember } from "@/app/admin/actions";
import { FormError } from "@/components/form-error";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useErrorText } from "@/lib/use-error-text";

export type TeamRow = {
  user_id: string;
  role: "super_admin" | "support";
  email: string | null;
  full_name: string;
  last_sign_in_at: string | null;
  isMe?: boolean;
};

export function TeamManager({ rows, canEdit }: { rows: TeamRow[]; canEdit: boolean }) {
  const t = useTranslations("team");
  const tn = useTranslations("adminNav");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();

  const columns: Column<TeamRow>[] = [
    {
      key: "name",
      header: t("colName"),
      width: "1.6fr",
      primary: true,
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-semibold">
            {r.full_name || "—"} {r.isMe ? <span className="text-muted">({t("you")})</span> : null}
          </span>
          <span className="text-xs text-muted">{r.email}</span>
        </span>
      ),
    },
    {
      key: "role",
      header: t("colRole"),
      cell: (r) => (
        <Badge tone={r.role === "super_admin" ? "green" : "blue"}>{tn(`role_${r.role}`)}</Badge>
      ),
    },
    {
      key: "login",
      header: t("colLastLogin"),
      cell: (r) => (
        <span className="num text-muted">
          {r.last_sign_in_at ? formatDateShort(new Date(r.last_sign_in_at)) : "—"}
        </span>
      ),
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: <span className="sr-only">{t("remove")}</span>,
            width: "60px",
            align: "end" as const,
            mobileFooter: true,
            cell: (r: TeamRow) =>
              r.isMe ? null : (
                <Button
                  size="icon-sm"
                  variant="danger"
                  aria-label={`${t("remove")}: ${r.email}`}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await removeTeamMember(r.user_id);
                      if (res.ok) toast.success(t("removed"));
                      else toast.error(errorText(res.formError));
                    })
                  }
                >
                  <Trash2 />
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </header>
      <div className="grid gap-5 desk:grid-cols-[1fr_360px]">
        <ResponsiveTable
          caption={t("title")}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.user_id}
        />
        {canEdit ? <AddMember /> : null}
      </div>
    </div>
  );
}

function AddMember() {
  const t = useTranslations("team");
  const tn = useTranslations("adminNav");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<TeamMemberInput>({
    resolver: zodResolver(teamMemberSchema),
    defaultValues: { email: "", role: "support" },
  });
  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await addTeamMember(form.getValues());
      if (res.ok) {
        toast.success(t("added"));
        form.reset();
      } else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {}))
          form.setError(field as keyof TeamMemberInput, { message: code });
        setFormError(res.formError ?? null);
      }
    });
  });
  return (
    <Card className="self-start">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">{t("add")}</h2>
        <p className="text-[13px] text-muted">{t("addHint")}</p>
        <FormError message={errorText(formError)} />
        <Field
          id="tm-email"
          label={t("email")}
          error={errorText(form.formState.errors.email?.message)}
        >
          <Input type="email" autoComplete="off" {...form.register("email")} />
        </Field>
        <Field id="tm-role" label={t("colRole")}>
          <NativeSelect {...form.register("role")}>
            <option value="support">{tn("role_support")}</option>
            <option value="super_admin">{tn("role_super_admin")}</option>
          </NativeSelect>
        </Field>
        <Button type="submit" disabled={pending}>
          {t("add")}
        </Button>
      </form>
    </Card>
  );
}
