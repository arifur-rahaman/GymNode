import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signupTitle") };
}

export default async function SignUpPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("signupTitle")} subtitle={t("signupSubtitle")}>
      <SignUpForm />
    </AuthCard>
  );
}
