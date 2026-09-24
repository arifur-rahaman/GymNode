import "server-only";
import { createClient } from "@/lib/supabase/server";

export const MEMBER_TABS = ["all", "active", "due", "expired", "frozen", "pending"] as const;
export type MemberTab = (typeof MEMBER_TABS)[number];
export const PAGE_SIZE = 25;

export type MemberListParams = { tab: MemberTab; q: string; pkg: string; page: number };

export function parseMemberListParams(
  sp: Record<string, string | string[] | undefined>,
): MemberListParams {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const tab = (MEMBER_TABS as readonly string[]).includes(get("tab"))
    ? (get("tab") as MemberTab)
    : "all";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(get("page") || "1", 10) || 1));
  return { tab, q: get("q").slice(0, 60), pkg: get("pkg"), page };
}

/** Characters that would break PostgREST's or() filter or act as LIKE wildcards. */
function cleanSearch(q: string) {
  return q.replace(/[%_,()*\\]/g, " ").trim();
}

/** Filtered member query (RLS applies: staff only ever see their own gym). */
export async function memberQuery(
  gymId: string,
  params: MemberListParams,
  { limit }: { limit?: number } = {},
) {
  const supabase = await createClient();
  let query = supabase.from("member_overview").select("*", { count: "exact" }).eq("gym_id", gymId);

  if (params.tab === "pending") query = query.eq("status", "pending");
  else {
    query = query.neq("status", "pending");
    if (params.tab !== "all") query = query.eq("display_status", params.tab);
  }
  if (params.pkg) query = query.eq("package_id", params.pkg);
  const q = cleanSearch(params.q);
  if (q) {
    // Phone numbers are stored as +8801…; "01711" still matches as a substring.
    query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,member_code.ilike.%${q}%`);
  }

  query =
    params.tab === "pending"
      ? query.order("created_at", { ascending: false })
      : query.order("expiry_sort", { ascending: true }).order("full_name");

  if (limit) return query.limit(limit);
  const from = (params.page - 1) * PAGE_SIZE;
  return query.range(from, from + PAGE_SIZE - 1);
}
