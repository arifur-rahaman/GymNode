import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MANAGEMENT, gymPackages, hasRole, requireGym } from "@/lib/gym-context";
import { PackagesManager } from "./packages-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("packages");
  return { title: t("title") };
}

export default async function PackagesPage() {
  const membership = await requireGym();
  const packages = await gymPackages(membership.gymId, { activeOnly: false });
  return <PackagesManager packages={packages} canEdit={hasRole(membership, MANAGEMENT)} />;
}
