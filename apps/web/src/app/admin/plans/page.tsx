import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPlatformRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PlansManager, type PlanRow } from "./plans-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("plans");
  return { title: t("title") };
}

export default async function AdminPlansPage() {
  const supabase = await createClient();
  const [{ data: plans }, { data: overview }, role] = await Promise.all([
    supabase
      .from("plans")
      .select(
        "id, code, name, name_en, price_paisa, billing_period, max_members, max_branches, max_devices, features, is_active",
      )
      .order("sort_order"),
    supabase.rpc("admin_overview"),
    getPlatformRole(),
  ]);
  const counts = new Map(
    ((overview as { plans?: { code: string; count: number }[] } | null)?.plans ?? []).map((p) => [
      p.code,
      p.count,
    ]),
  );
  const rows: PlanRow[] = (plans ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    nameEn: p.name_en,
    pricePaisa: p.price_paisa,
    billingPeriod: p.billing_period as "monthly" | "yearly",
    maxMembers: p.max_members,
    maxBranches: p.max_branches,
    maxDevices: p.max_devices,
    features: Object.entries((p.features ?? {}) as Record<string, boolean>)
      .filter(([, on]) => on)
      .map(([k]) => k),
    isActive: p.is_active,
    gyms: counts.get(p.code) ?? 0,
  }));
  return <PlansManager plans={rows} canEdit={role === "super_admin"} />;
}
