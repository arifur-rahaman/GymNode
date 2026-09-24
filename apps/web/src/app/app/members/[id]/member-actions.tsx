"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Trash2, WalletCards } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  addDays,
  formatDateShort,
  freezeSchema,
  type FreezeInput,
  type IsoDate,
} from "@gymnode/core";
import {
  deleteMember,
  freezeMembership,
  renewMembership,
  unfreezeMembership,
} from "@/app/app/members/actions";
import { FormError } from "@/components/form-error";
import {
  PaymentFields,
  usePaymentForm,
  type PackageOption,
} from "@/components/payments/payment-fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useErrorText } from "@/lib/use-error-text";

/** "পেমেন্ট নিন ও রিনিউ" panel (full-screen sheet on phones). */
export function RenewSheet({
  memberId,
  memberLabel,
  packages,
  today,
  currentEndDate,
  currentPackageId,
  isFirstMembership,
  duePaisa,
}: {
  memberId: string;
  memberLabel: string;
  packages: PackageOption[];
  today: IsoDate;
  currentEndDate: IsoDate | null;
  currentPackageId: string | null;
  isFirstMembership: boolean;
  duePaisa: number;
}) {
  const t = useTranslations("profile");
  const tp = useTranslations("payment");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const defaultPkg = packages.some((p) => p.id === currentPackageId)
    ? currentPackageId!
    : packages[0]?.id;
  const form = usePaymentForm(defaultPkg);

  const onSubmit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await renewMembership(memberId, form.getValues());
      if (res.ok) {
        toast.success(tp("paid", { date: formatDateShort(res.data!.endDate) }));
        setOpen(false);
        form.reset();
      } else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {})) {
          form.setError(field as "packageId", { message: code });
        }
        setFormError(res.formError ?? null);
      }
    });
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <WalletCards /> {t("takePayment")}
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={tc("close")}>
        <SheetTitle>{t("takePayment")}</SheetTitle>
        <SheetDescription className="mt-1">{memberLabel}</SheetDescription>
        <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-1 flex-col gap-4">
          <FormError message={errorText(formError)} />
          <PaymentFields
            form={form}
            packages={packages}
            today={today}
            currentEndDate={currentEndDate}
            isFirstMembership={isFirstMembership}
            previousDuePaisa={duePaisa}
            idPrefix="renew"
          />
          <Button type="submit" size="lg" disabled={pending} className="mt-auto">
            {pending ? tp("confirming") : tp("confirm")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function FreezeControls({
  memberId,
  membershipId,
  isFrozen,
  today,
}: {
  memberId: string;
  membershipId: string;
  isFrozen: boolean;
  today: IsoDate;
}) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FreezeInput>({
    resolver: zodResolver(freezeSchema),
    defaultValues: { from: today, until: addDays(today, 6), reason: "" },
  });

  if (isFrozen) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="secondary">
            <Play /> {t("unfreeze")}
          </Button>
        </SheetTrigger>
        <SheetContent closeLabel={tc("close")}>
          <SheetTitle>{t("unfreeze")}</SheetTitle>
          <SheetDescription className="mt-2">{t("unfreezeConfirm")}</SheetDescription>
          <Button
            size="lg"
            className="mt-6"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await unfreezeMembership(memberId, membershipId);
                if (res.ok) {
                  toast.success(t("unfrozen"));
                  setOpen(false);
                } else toast.error(errorText(res.formError));
              })
            }
          >
            {t("unfreeze")}
          </Button>
        </SheetContent>
      </Sheet>
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const res = await freezeMembership(memberId, membershipId, values);
      if (res.ok) {
        toast.success(t("frozen"));
        setOpen(false);
      } else {
        for (const [field, code] of Object.entries(res.fieldErrors ?? {})) {
          form.setError(field as keyof FreezeInput, { message: code });
        }
        setFormError(res.formError ?? null);
      }
    });
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary">
          <Pause /> {t("freeze")}
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={tc("close")}>
        <SheetTitle>{t("freezeTitle")}</SheetTitle>
        <SheetDescription className="mt-1">{t("freezeHint")}</SheetDescription>
        <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
          <FormError message={errorText(formError)} />
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="fz-from"
              label={t("freezeFrom")}
              error={errorText(form.formState.errors.from?.message)}
            >
              <Input type="date" className="num" min={today} {...form.register("from")} />
            </Field>
            <Field
              id="fz-until"
              label={t("freezeUntil")}
              error={errorText(form.formState.errors.until?.message)}
            >
              <Input type="date" className="num" min={today} {...form.register("until")} />
            </Field>
          </div>
          <Field
            id="fz-reason"
            label={t("freezeReason")}
            error={errorText(form.formState.errors.reason?.message)}
          >
            <Input {...form.register("reason")} />
          </Field>
          <Button type="submit" size="lg" disabled={pending}>
            {t("freezeSave")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function DeleteMemberButton({ memberId, name }: { memberId: string; name: string }) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const errorText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="danger">
          <Trash2 /> {t("deleteMember")}
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={tc("close")}>
        <SheetTitle>{t("deleteMember")}</SheetTitle>
        <SheetDescription className="mt-2">{t("deleteConfirm", { name })}</SheetDescription>
        <Button
          variant="danger"
          size="lg"
          className="mt-6"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await deleteMember(memberId);
              if (res.ok) {
                toast.success(t("deleted"));
                router.push("/app/members");
              } else toast.error(errorText(res.formError));
            })
          }
        >
          {tc("delete")}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
