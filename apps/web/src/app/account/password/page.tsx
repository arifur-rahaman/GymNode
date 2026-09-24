import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { getProfile, requireUserId } from "@/lib/auth";
import { NewPasswordForm } from "./new-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("setPasswordTitle") };
}

export default async function SetPasswordPage() {
  await requireUserId("/account/password");
  const t = await getTranslations("auth");
  const profile = await getProfile();
  return (
    <AuthCard
      title={t("setPasswordTitle")}
      subtitle={profile?.must_change_password ? t("setPasswordForced") : undefined}
    >
      <NewPasswordForm />
    </AuthCard>
  );
}
