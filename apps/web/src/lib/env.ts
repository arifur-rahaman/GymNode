import { z } from "zod";

/**
 * Public Supabase settings. Values come from .env.local (see .env.example).
 * Returns null when not configured, so the app still builds and the UI gallery
 * still works without a database (e.g. in CI's build step).
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type PublicSupabaseEnv = { url: string; publishableKey: string };

export function getPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const parsed = publicEnvSchema.safeParse({
    // Written out in full so Next.js can inline them into browser code.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) return null;
  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function requirePublicSupabaseEnv(): PublicSupabaseEnv {
  const env = getPublicSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to apps/web/.env.local and fill in the values from `pnpm exec supabase status`.",
    );
  }
  return env;
}
