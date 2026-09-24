import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("auth");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : null;
  const error = typeof params.error === "string" ? params.error : null;
  return (
    <AuthCard title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      <LoginForm next={next} initialError={error} />
    </AuthCard>
  );
}
