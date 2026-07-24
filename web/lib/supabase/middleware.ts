import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { stripLocalePrefix } from "@/i18n/routing";

const ACCOUNT_PROTECTED_PREFIXES = [
  "/onboarding",
  "/inbox",
  "/account",
  "/admin",
];

/** FPL hub landing page — public; features under these paths require sign-in. */
export const FPL_HUB_PATH = "/fpl";

/** FPL tools linked from the hub (excluding the hub page itself). */
export const FPL_FEATURE_PREFIXES = [
  "/dashboard",
  "/manager",
  "/planner",
  "/players",
  "/player",
  "/chat",
];

export function isAdminPath(pathname: string): boolean {
  const path = stripLocalePrefix(pathname);
  return path === "/admin" || path.startsWith("/admin/");
}

export function isFplFeaturePath(pathname: string): boolean {
  const path = stripLocalePrefix(pathname);
  if (path === FPL_HUB_PATH) return false;
  if (path.startsWith(`${FPL_HUB_PATH}/`)) return true;
  return FPL_FEATURE_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

export function isFplProtectedApiPath(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname === "/api/chat" || pathname.startsWith("/api/chat/")) {
    return true;
  }
  if (pathname.startsWith("/api/planner/")) return true;
  if (pathname.startsWith("/api/team/")) return true;
  if (/^\/api\/player\/[^/]+\/radar/.test(pathname)) return true;
  if (pathname.startsWith("/api/fpl/")) return true;
  return false;
}

export function isProtectedPath(pathname: string): boolean {
  const path = stripLocalePrefix(pathname);
  if (
    ACCOUNT_PROTECTED_PREFIXES.some(
      (p) => path === p || path.startsWith(`${p}/`),
    )
  ) {
    return true;
  }
  return isFplFeaturePath(pathname);
}

export async function updateSupabaseSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { response: supabaseResponse, user: null };
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user };
}
