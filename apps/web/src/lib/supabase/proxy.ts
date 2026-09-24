import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/env";

const PROTECTED = ["/app", "/admin", "/onboarding", "/account"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Runs before every page: refreshes the Supabase session cookie (Server Components
 * cannot write cookies) and does the coarse login check. Fine-grained permission
 * checks happen in layouts and, above all, in the database (RLS).
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
  const { data } = await supabase.auth.getClaims();
  const loggedIn = !!data?.claims?.sub;
  const path = request.nextUrl.pathname;

  const redirectTo = (target: string, withNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = withNext ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    const res = NextResponse.redirect(url);
    // Keep any refreshed session cookies.
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!loggedIn && startsWithAny(path, PROTECTED)) return redirectTo("/login", true);
  if (loggedIn && startsWithAny(path, AUTH_PAGES)) return redirectTo("/");

  return response;
}
