import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { toLocalBdPhone } from "@gymnode/core";
import { getActiveMembership, getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StaffManager, type StaffRow } from "./staff-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staff");
  return { title: t("title") };
}

export default async function StaffPage() {
  const t = await getTranslations("staff");
  const te = await getTranslations("errors");
  const membership = (await getActiveMembership())!;
  if (membership.role !== "owner" && membership.role !== "manager") {
    return <p className="text-muted">{te("forbidden")}</p>;
  }

  const supabase = await createClient();
  const userId = await getUserId();
  const { data } = await supabase
    .from("gym_users")
    .select("id, user_id, role, display_name, is_active")
    .eq("gym_id", membership.gymId)
    .order("created_at");
  // Separate query: gym_users and profiles are both keyed by auth user id (no direct link to embed).
  const userIds = (data ?? []).map((r) => r.user_id);
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, phone, must_change_password")
        .in("user_id", userIds)
    : { data: [] };
  const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const rows: StaffRow[] = (data ?? []).map((r) => {
    const profile = byUser.get(r.user_id);
    return {
      id: r.id,
      name: r.display_name,
      role: r.role,
      isActive: r.is_active,
      isSelf: r.user_id === userId,
      phone: profile?.phone ? toLocalBdPhone(profile.phone) : null,
      mustChangePassword: profile?.must_change_password ?? false,
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <StaffManager
        title={t("title")}
        gymId={membership.gymId}
        rows={rows}
        allowedRoles={
          membership.role === "owner"
            ? ["manager", "reception", "trainer"]
            : ["reception", "trainer"]
        }
      />
    </div>
  );
}
