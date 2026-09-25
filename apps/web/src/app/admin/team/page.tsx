import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPlatformRole, getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TeamManager, type TeamRow } from "./team-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("team");
  return { title: t("title") };
}

export default async function AdminTeamPage() {
  const supabase = await createClient();
  const [{ data }, role, me] = await Promise.all([
    supabase.rpc("admin_list_team"),
    getPlatformRole(),
    getUserId(),
  ]);
  const rows = ((data ?? []) as TeamRow[]).map((r) => ({ ...r, isMe: r.user_id === me }));
  return <TeamManager rows={rows} canEdit={role === "super_admin"} />;
}
