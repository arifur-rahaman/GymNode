import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@gymnode/db";
import { requirePublicSupabaseEnv } from "@/lib/env";

/** Supabase client for Client Components. Runs as the logged-in user; RLS applies. */
export function createClient() {
  const { url, publishableKey } = requirePublicSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
