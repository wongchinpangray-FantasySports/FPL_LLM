import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import { localePath } from "@/lib/auth/auth-path";
import { getSiteUrl } from "@/lib/auth/site-url";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { email?: string; locale?: string };

export async function POST(request: NextRequest) {
  try {
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const body = (await request.json()) as Body;
    const email = body.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const locale =
      body.locale && routing.locales.includes(body.locale as "en" | "zh")
        ? body.locale
        : routing.defaultLocale;
    const resetPath = localePath(locale, "/auth/reset-password");
    const siteUrl = getSiteUrl(request);
    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(resetPath)}`;

    const { supabase, jsonResponse } =
      createSupabaseRouteHandlerClient(request);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("[forgot-password]", error.message);
    }

    // Always succeed so callers cannot probe for registered emails.
    return jsonResponse({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
