import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requirePublicSupabaseEnv } from "@/lib/env";

/**
 * Supabase client with the SECRET key. It bypasses RLS, so it is used for exactly one
 * thing: creating / resetting staff logins through the Auth admin API (PLAN.md §2.2).
 * Every database write still goes through the caller's own client and RLS-checked
 * functions. `server-only` makes the build fail if this is ever imported in the browser.
 */
export function createAdminClient() {
  const { url } = requirePublicSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY is not set. See .env.example.");
  }
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
