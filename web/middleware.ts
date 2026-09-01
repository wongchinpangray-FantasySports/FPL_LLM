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
import { localePath } from "./lib/auth/auth-path";
import { isAdminEmail } from "./lib/auth/admin";
import {
  SHARE_VISITOR_COOKIE,
  SHARE_VISITOR_COOKIE_MAX_AGE,
  isShareVisitorId,
  newShareVisitorId,
} from "./lib/share/visitor";

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

  // Chinese-only site: permanently send legacy English URLs to the ZH equivalent.
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone();
    url.pathname =
      pathname === "/en" ? "/" : pathname.replace(/^\/en(?=\/|$)/, "") || "/";
    const res = NextResponse.redirect(url, 308);
    // Drop stale EN locale cookie so next-intl does not keep preferring English.
    res.cookies.set("NEXT_LOCALE", "zh", { path: "/" });
    return res;
  }

  const pathNoLocale = stripLocalePrefix(pathname);
  if (
    pathNoLocale === "/news/fpl-creators" ||
    pathNoLocale.startsWith("/news/fpl-creators/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = localePath("zh", "/news");
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/auth/callback") {
    return NextResponse.next();
  }

  if (isApiRoute) {
    if (!isFplProtectedApiPath(pathname)) {
      return NextResponse.next();
    }
    const allowLocalApiPreview =
      process.env.NODE_ENV === "development" &&
      process.env.ALLOW_LOCAL_DASHBOARD_PREVIEW === "1" &&
      (pathname.startsWith("/api/transfers/") ||
        pathname.startsWith("/api/team/"));
    if (allowLocalApiPreview) {
      return NextResponse.next();
    }
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  let response = intlMiddleware(request);

  if (pathNoLocale === "/s" || pathNoLocale.startsWith("/s/")) {
    const existing = request.cookies.get(SHARE_VISITOR_COOKIE)?.value;
    if (!isShareVisitorId(existing)) {
      response.cookies.set(SHARE_VISITOR_COOKIE, newShareVisitorId(), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: SHARE_VISITOR_COOKIE_MAX_AGE,
      });
    }
  }

  if (!isProtectedPath(pathname) && !isAdminPath(pathname)) {
    return response;
  }

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
    const allowLocalDashboardPreview =
      process.env.NODE_ENV === "development" &&
      process.env.ALLOW_LOCAL_DASHBOARD_PREVIEW === "1" &&
      (() => {
        const path = stripLocalePrefix(pathname);
        return (
          path === "/dashboard" ||
          path.startsWith("/dashboard/") ||
          path === "/transfers" ||
          path.startsWith("/transfers/") ||
          path === "/planner" ||
          path.startsWith("/planner/")
        );
      })();
    if (!allowLocalDashboardPreview) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("next", stripLocalePrefix(pathname));
      return NextResponse.redirect(loginUrl);
    }
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
