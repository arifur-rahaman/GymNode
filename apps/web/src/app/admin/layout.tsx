import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getPlatformRole, getProfile, requireUserId } from "@/lib/auth";
import { THEME_COOKIE, parseTheme } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";

/** Super admin area (SA-*.dc.html): GymNode team members only. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireUserId("/admin");
  const profile = await getProfile();
  if (profile?.must_change_password) redirect("/account/password");
  const role = await getPlatformRole();
  if (!role) redirect("/");

  const supabase = await createClient();
  const [{ data: invoices }, { data: tickets }] = await Promise.all([
    supabase.rpc("admin_list_invoices", { p_status: "overdue", p_limit: 1 }),
    supabase.rpc("admin_list_tickets", { p_status: "open", p_limit: 1 }),
  ]);
  const badges: Record<string, number> = {};
  const overdue = Number(
    (invoices as { counts?: { overdue?: number } } | null)?.counts?.overdue ?? 0,
  );
  const open = Number((tickets as { counts?: { open?: number } } | null)?.counts?.open ?? 0);
  if (overdue) badges.billing = overdue;
  if (open) badges.support = open;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <AdminShell
      userName={profile?.full_name || "Admin"}
      role={role}
      isSuper={role === "super_admin"}
      badges={badges}
      theme={theme}
    >
      {children}
    </AdminShell>
  );
}
