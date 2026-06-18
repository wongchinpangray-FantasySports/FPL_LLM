import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";

let runtimeConfig: { url: string; key: string } | null = null;

async function loadAuthConfig(): Promise<{ url: string; key: string }> {
  const builtIn = getSupabaseAuthEnv();
  if (builtIn) return builtIn;

  if (runtimeConfig) return runtimeConfig;

  const res = await fetch("/api/auth/config");
  const data = (await res.json()) as {
    url?: string;
    anonKey?: string;
    error?: string;
  };
  if (!res.ok || !data.url || !data.anonKey) {
    throw new Error(
      data.error ??
        "Missing or invalid NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  runtimeConfig = { url: data.url, key: data.anonKey };
  return runtimeConfig;
}

export async function createSupabaseBrowserClient(): Promise<SupabaseClient> {
  const env = await loadAuthConfig();
  return createBrowserClient(env.url, env.key);
}
