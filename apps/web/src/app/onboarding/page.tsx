import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { getActiveMembership, getMemberships, getProfile, requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GymStep } from "./gym-step";
import { LogoStep } from "./logo-step";
import { PackagesStep } from "./packages-step";
import { StaffStep } from "./staff-step";
import { Stepper } from "./stepper";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

const STEPS = ["gym", "logo", "packages", "staff"] as const;
type Step = (typeof STEPS)[number];

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  await requireUserId("/onboarding");
  const profile = await getProfile();
  if (profile?.must_change_password) redirect("/account/password");

  const t = await getTranslations("onboarding");
  const params = await searchParams;
  const memberships = await getMemberships();
  const active = await getActiveMembership();

  // An owner whose gym is not finished continues where they left off.
  const unfinished =
    (active?.role === "owner" && !active.gym.onboardingCompletedAt ? active : null) ??
    memberships.find((m) => m.role === "owner" && !m.gym.onboardingCompletedAt) ??
    null;
  const wantsNewGym = params.new === "1";

  if (!unfinished && memberships.length > 0 && !wantsNewGym) redirect("/app");

  const requested = (typeof params.step === "string" ? params.step : "gym") as Step;
  const step: Step = unfinished
    ? requested === "gym" || !STEPS.includes(requested)
      ? "logo"
      : requested
    : "gym";
  const current = STEPS.indexOf(step) + 1;

  let body: React.ReactNode;
  if (step === "gym" || !unfinished) {
    body = <GymStep />;
  } else if (step === "logo") {
    body = <LogoStep gymId={unfinished.gymId} />;
  } else if (step === "packages") {
    const supabase = await createClient();
    const { count } = await supabase
      .from("packages")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", unfinished.gymId)
      .is("deleted_at", null);
    body = <PackagesStep gymId={unfinished.gymId} existingCount={count ?? 0} />;
  } else {
    const supabase = await createClient();
    const { data: staff } = await supabase
      .from("gym_users")
      .select("id, display_name, role")
      .eq("gym_id", unfinished.gymId)
      .neq("role", "owner")
      .order("created_at");
    body = <StaffStep gymId={unfinished.gymId} staff={staff ?? []} />;
  }

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("step", { current: String(current), total: String(STEPS.length) })}
      wide
    >
      <Stepper
        current={current}
        labels={[t("gymStep"), t("logoStep"), t("packagesStep"), t("staffStep")]}
      />
      <div className="mt-6">{body}</div>
    </AuthCard>
  );
}
