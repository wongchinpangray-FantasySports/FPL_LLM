import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _serverClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client. Uses the service-role key so it can read
 * anything. NEVER import this from a "use client" file.
 */
export function getServerSupabase(): SupabaseClient {
  if (_serverClient) return _serverClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_* equivalents).",
    );
  }
  _serverClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _serverClient;
}
