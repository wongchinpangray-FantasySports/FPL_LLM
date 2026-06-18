import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { getSupabaseAuthEnv } from "./lib/supabase/auth-config";
import { isProtectedPath } from "./lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  let response = intlMiddleware(request);
  const pathname = request.nextUrl.pathname;

  const authEnv = getSupabaseAuthEnv();

  let user = null;
  if (authEnv) {
    try {
      const supabase = createServerClient(authEnv.url, authEnv.key, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }
            response = intlMiddleware(request);
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      });
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      /* misconfigured auth must not take down anonymous browsing */
    }
  }

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
