export type SupabaseEnv = { url: string; key: string };

/**
 * Returns the public Supabase settings, or null if they are missing/invalid.
 * Env vars are referenced literally so Next.js can inline them into the client bundle.
 */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return null;
    }
  } catch {
    return null;
  }
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null;
}

export function getSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  return env;
}
