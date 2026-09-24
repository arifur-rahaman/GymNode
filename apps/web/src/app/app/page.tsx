import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateLong, type Locale } from "@gymnode/core";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveMembership, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

// M1 dashboard: welcome + setup checklist. The real dashboard (KPIs, charts, live
// check-ins from Dashboard-*.dc.html) is built in M4 once there is data to show.
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const locale = (await getLocale()) as Locale;
  const membership = (await getActiveMembership())!;
  const profile = await getProfile();
  const supabase = await createClient();

  const [{ count: packageCount }, { count: staffCount }] = await Promise.all([
    supabase
      .from("packages")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", membership.gymId)
      .is("deleted_at", null),
    supabase
      .from("gym_users")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", membership.gymId)
      .neq("role", "owner"),
  ]);
  const canManageStaff = membership.role === "owner" || membership.role === "manager";

  const checklist = [
    { done: true, label: t("setupDone") },
    {
      done: (packageCount ?? 0) > 0,
      label: t("packagesCount", { count: String(packageCount ?? 0) }),
    },
    { done: (staffCount ?? 0) > 0, label: t("staffCount", { count: String(staffCount ?? 0) }) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{tn("dashboard")}</h1>
        <p className="text-[15px] text-muted">
          {formatDateLong(new Date(), locale)} · {t("greeting", { name: profile?.full_name || "" })}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("setupTitle")}</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-3">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-3">
              {item.done ? (
                <CheckCircle2 className="size-5 text-success" aria-hidden />
              ) : (
                <Circle className="size-5 text-muted" aria-hidden />
              )}
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        {canManageStaff ? (
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/app/staff">{t("addStaff")}</Link>
          </Button>
        ) : null}
      </Card>

      <EmptyState
        icon={<Users />}
        message={t("nextMembers")}
        action={
          <Button asChild>
            <Link href="/app/members">{t("goMembers")}</Link>
          </Button>
        }
      />
    </div>
  );
}
