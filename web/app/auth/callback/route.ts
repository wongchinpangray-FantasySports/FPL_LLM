import { type NextRequest } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import { safePasswordResetNextPath } from "@/lib/auth/safe-next-path";
import { getSiteUrl } from "@/lib/auth/site-url";
import { localePath } from "@/lib/auth/auth-path";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const siteUrl = getSiteUrl(request);
  const loginUrl = new URL(localePath(routing.defaultLocale, "/auth/login"), siteUrl);

  try {
    if (!getSupabaseAuthEnv()) {
      loginUrl.searchParams.set("error", "auth_not_configured");
      return Response.redirect(loginUrl);
    }

    const code = request.nextUrl.searchParams.get("code");
    const next = safePasswordResetNextPath(
      request.nextUrl.searchParams.get("next"),
    );

    if (!code || !next) {
      loginUrl.searchParams.set("error", "invalid_reset_link");
      return Response.redirect(loginUrl);
    }

    const { supabase, redirectResponse } =
      createSupabaseRouteHandlerClient(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      loginUrl.searchParams.set("error", "invalid_reset_link");
      return Response.redirect(loginUrl);
    }

    return redirectResponse(new URL(next, siteUrl));
  } catch {
    loginUrl.searchParams.set("error", "invalid_reset_link");
    return Response.redirect(loginUrl);
  }
}
