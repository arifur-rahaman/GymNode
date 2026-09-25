import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPlatformRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platformSettings");
  return { title: t("title") };
}

export default async function AdminSettingsPage() {
  if ((await getPlatformRole()) !== "super_admin") redirect("/admin");
  const t = await getTranslations("platformSettings");
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("key, value");
  const get = (k: string, d: number) => {
    const v = data?.find((r) => r.key === k)?.value;
    return typeof v === "number" ? v : Number(v ?? d) || d;
  };
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <header>
        <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </header>
      <SettingsForm trialDays={get("trial_days", 14)} graceDays={get("past_due_grace_days", 7)} />
    </div>
  );
}
