import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";

export function createSupabaseBrowserClient() {
  const env = getSupabaseAuthEnv();
  if (!env) {
    throw new Error(
      "Missing or invalid NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createBrowserClient(env.url, env.key);
}
