import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { getSupabaseAuthEnv } from "./lib/supabase/auth-config";
import {
  isAdminPath,
  isFplProtectedApiPath,
  isProtectedPath,
} from "./lib/supabase/middleware";
import { stripLocalePrefix } from "./i18n/routing";
import { isAdminEmail } from "./lib/auth/admin";

const intlMiddleware = createIntlMiddleware(routing);

async function getRequestUser(request: NextRequest) {
  const authEnv = getSupabaseAuthEnv();
  if (!authEnv) return null;

  try {
    const supabase = createServerClient(authEnv.url, authEnv.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(_cookiesToSet: Parameters<SetAllCookies>[0]) {
          /* API auth checks do not need to refresh cookies here */
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");

  if (isApiRoute) {
    if (!isFplProtectedApiPath(pathname)) {
      return NextResponse.next();
    }
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  let response = intlMiddleware(request);

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
    loginUrl.searchParams.set("next", stripLocalePrefix(pathname));
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminPath(pathname) && user && !isAdminEmail(user.email)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next|_vercel|.*\\..*).*)",
  ],
};
