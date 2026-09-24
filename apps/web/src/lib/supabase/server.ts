import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@gymnode/db";
import { requirePublicSupabaseEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Uses the logged-in user's session from cookies, so RLS applies. Create one per request.
 * The service-role/secret key is NEVER used here (PLAN.md §2.2).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = requirePublicSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which cannot set cookies.
          // Safe to ignore: proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
