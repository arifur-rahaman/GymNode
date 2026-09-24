import { redirect } from "next/navigation";
import { getUserId, homePathForUser } from "@/lib/auth";

// "/" sends each person to the right place: login, onboarding, gym panel or super admin.
export default async function HomePage() {
  const userId = await getUserId().catch(() => null);
  redirect(userId ? await homePathForUser() : "/login");
}
