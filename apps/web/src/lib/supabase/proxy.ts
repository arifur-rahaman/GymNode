import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie on each request (Server Components cannot
 * write cookies themselves). Pattern from Supabase's Next.js SSR guide.
 * Route protection (/app, /admin) is added in M1.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicSupabaseEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not put code between createServerClient and getClaims(): it can cause
  // hard-to-debug random logouts. getClaims() validates the JWT and refreshes it if needed.
  await supabase.auth.getClaims();

  return response;
}
