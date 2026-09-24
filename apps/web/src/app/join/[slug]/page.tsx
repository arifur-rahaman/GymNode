import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { robots: { index: false } };

export default async function JoinPage({ params }: PageProps<"/join/[slug]">) {
  const { slug } = await params;
  const t = await getTranslations("join");
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_join_gym", { p_slug: slug });
  const gym = data?.[0];

  if (!gym) {
    return (
      <AuthCard title={t("notFound")}>
        <p className="text-muted">{t("notFound")}</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t("title", { gym: gym.name })} subtitle={t("subtitle")}>
      <JoinForm slug={slug} />
    </AuthCard>
  );
}
