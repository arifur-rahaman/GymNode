"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { z } from "zod";
import { GENDERS, memberSchema, type IsoDate, type MemberInput } from "@gymnode/core";
import { createMember, saveMemberPhoto, updateMember } from "@/app/app/members/actions";
import { FormError } from "@/components/form-error";
import {
  PaymentFields,
  usePaymentForm,
  type PackageOption,
} from "@/components/payments/payment-fields";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { useErrorText } from "@/lib/use-error-text";
import { PhotoPicker } from "./photo-picker";

type Props = {
  mode: "create" | "edit";
  gymId: string;
  memberId?: string;
  initial?: MemberInput;
  photoUrl?: string | null;
  trainers: { id: string; display_name: string }[];
  packages?: PackageOption[];
  today: IsoDate;
};

const EMPTY: MemberInput = {
  fullName: "",
  phone: "",
  gender: "",
  dob: "",
  address: "",
  emergencyName: "",
  emergencyPhone: "",
  trainerId: "",
  notes: "",
};

async function uploadPhoto(gymId: string, memberId: string, file: File) {
  const blob = await compressImage(file, 480, 0.8);
  const path = `${gymId}/${memberId}/${Date.now()}.webp`;
  const { error } = await createClient()
    .storage.from("member-photos")
    .upload(path, blob, { contentType: "image/webp" });
  if (error) throw error;
  const result = await saveMemberPhoto(memberId, path);
  if (!result.ok) throw new Error(result.formError);
}

export function MemberForm({
  mode,
  gymId,
  memberId,
  initial,
  photoUrl,
  trainers,
  packages = [],
  today,
}: Props) {
  const t = useTranslations("memberForm");
  const tg = useTranslations("genders");
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [withPayment, setWithPayment] = useState(mode === "create" && packages.length > 0);

  const form = useForm<MemberInput, unknown, z.output<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: initial ?? EMPTY,
  });
  const payForm = usePaymentForm(packages[0]?.id);
  const name = useWatch({ control: form.control, name: "fullName" });
  const { errors } = form.formState;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const [memberOk, payOk] = await Promise.all([
      form.trigger(),
      withPayment ? payForm.trigger() : true,
    ]);
    if (!memberOk || !payOk) return;

    startTransition(async () => {
      const values = form.getValues();
      const result =
        mode === "create"
          ? await createMember(values, withPayment ? payForm.getValues() : null)
          : await updateMember(memberId!, values);

      if (!result.ok) {
        for (const [field, code] of Object.entries(result.fieldErrors ?? {})) {
          if (field.startsWith("payment."))
            payForm.setError(field.slice(8) as "packageId", { message: code });
          else form.setError(field as keyof MemberInput, { message: code });
        }
        setFormError(result.formError ?? null);
        return;
      }

      const id = mode === "create" ? (result.data as { id: string; code: string }).id : memberId!;
      if (photo) {
        try {
          await uploadPhoto(gymId, id, photo);
        } catch {
          toast.error(errorText("uploadFailed"));
        }
      }
      if (mode === "create") {
        const { code } = result.data as { id: string; code: string };
        toast.success(t("created", { name: values.fullName, code }));
      } else {
        toast.success(t("saved"));
      }
      router.push(`/app/members/${id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormError message={errorText(formError)} />
      <Card>
        <CardHeader>
          <CardTitle>{t("personal")}</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-4">
          <PhotoPicker name={name} initialUrl={photoUrl} onChange={setPhoto} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="m-name" label={t("fullName")} error={errorText(errors.fullName?.message)}>
              <Input autoComplete="off" {...form.register("fullName")} />
            </Field>
            <Field id="m-phone" label={t("phone")} error={errorText(errors.phone?.message)}>
              <Input
                type="tel"
                inputMode="tel"
                className="num"
                placeholder="01712345678"
                autoComplete="off"
                {...form.register("phone")}
              />
            </Field>
            <Field id="m-gender" label={t("gender")} error={errorText(errors.gender?.message)}>
              <NativeSelect {...form.register("gender")}>
                <option value="">{t("chooseGender")}</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {tg(g)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="m-dob" label={t("dob")} error={errorText(errors.dob?.message)}>
              <Input type="date" className="num" max={today} {...form.register("dob")} />
            </Field>
            <Field
              id="m-address"
              label={t("address")}
              error={errorText(errors.address?.message)}
              className="md:col-span-2"
            >
              <Input {...form.register("address")} />
            </Field>
            <Field
              id="m-em-name"
              label={t("emergencyName")}
              error={errorText(errors.emergencyName?.message)}
            >
              <Input {...form.register("emergencyName")} />
            </Field>
            <Field
              id="m-em-phone"
              label={t("emergencyPhone")}
              error={errorText(errors.emergencyPhone?.message)}
            >
              <Input
                type="tel"
                inputMode="tel"
                className="num"
                {...form.register("emergencyPhone")}
              />
            </Field>
            {trainers.length > 0 ? (
              <Field
                id="m-trainer"
                label={t("trainer")}
                error={errorText(errors.trainerId?.message)}
              >
                <NativeSelect {...form.register("trainerId")}>
                  <option value="">{t("noTrainer")}</option>
                  {trainers.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.display_name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            <Field
              id="m-notes"
              label={t("notes")}
              error={errorText(errors.notes?.message)}
              className="md:col-span-2"
            >
              <Input {...form.register("notes")} />
            </Field>
          </div>
        </div>
      </Card>

      {mode === "create" && packages.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("membership")}</CardTitle>
          </CardHeader>
          <label className="mb-4 flex min-h-11 items-center gap-2.5 text-sm">
            <Checkbox checked={!withPayment} onChange={(e) => setWithPayment(!e.target.checked)} />
            {t("skipPayment")}
          </label>
          {withPayment ? (
            <PaymentFields
              form={payForm}
              packages={packages}
              today={today}
              currentEndDate={null}
              isFirstMembership
            />
          ) : null}
        </Card>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="md:self-end md:px-10">
        {pending ? t("saving") : mode === "create" && withPayment ? t("saveAndPay") : t("save")}
      </Button>
    </form>
  );
}
