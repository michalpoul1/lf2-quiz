import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client. Uses NEXT_PUBLIC_* env vars so the anon key ships
 * to the client — that's the intended flow for user-facing auth.
 *
 * The client is created lazily: builds without env vars still succeed (Vercel
 * sets them per environment), and the app throws a clear error the first time
 * code actually tries to reach Supabase rather than at import time.
 */

let cached: SupabaseClient | null = null;

function readEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase není nakonfigurovaný: chybí NEXT_PUBLIC_SUPABASE_URL nebo NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Zkontroluj .env.local (lokálně) nebo proměnné prostředí (Vercel)."
    );
  }
  return { url, anonKey };
}

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const { url, anonKey } = readEnv();
  cached = createClient(url, anonKey);
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
