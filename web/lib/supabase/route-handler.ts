import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";

/**
 * Supabase client for Route Handlers. Session cookies must be copied onto the
 * final JSON response — returning a fresh NextResponse.json() alone drops them
 * on Workers / OpenNext.
 */
export function createSupabaseRouteHandlerClient(request: NextRequest) {
  const env = getSupabaseAuthEnv();
  if (!env) {
    throw new Error(
      "Missing or invalid NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  let cookieResponse = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        cookieResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          cookieResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  function jsonResponse(body: unknown, init?: ResponseInit) {
    const res = NextResponse.json(body, init);
    for (const cookie of cookieResponse.cookies.getAll()) {
      res.cookies.set(cookie);
    }
    return res;
  }

  return { supabase, jsonResponse };
}
