import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/(auth)/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

export default async function AdminHomePage() {
  const t = await getTranslations("admin");
  const ta = await getTranslations("auth");
  return (
    <AuthCard title={t("title")} subtitle={t("body")}>
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          <LogOut /> {ta("logout")}
        </Button>
      </form>
    </AuthCard>
  );
}
