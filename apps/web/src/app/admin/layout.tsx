import { redirect } from "next/navigation";
import { getProfile, isPlatformAdmin, requireUserId } from "@/lib/auth";

/** Super admin area: platform admins only. Full panel (SA-*.dc.html) arrives in M7. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireUserId("/admin");
  const profile = await getProfile();
  if (profile?.must_change_password) redirect("/account/password");
  if (!(await isPlatformAdmin())) redirect("/");
  return children;
}
