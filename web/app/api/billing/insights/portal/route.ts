import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import { getSiteUrl } from "@/lib/auth/site-url";
import { isStripeConfigured } from "@/lib/stripe/server";
import { createInsightsPortalSession } from "@/lib/stripe/insights-billing";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Billing is not configured yet" },
        { status: 503 },
      );
    }

    const supa = createSupabaseServerClient();
    const { data: authData, error: authError } = await supa.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      returnPath?: string;
    };
    const returnPath =
      typeof body.returnPath === "string" && body.returnPath.startsWith("/")
        ? body.returnPath
        : "/account";

    const siteUrl = getSiteUrl(request);
    const url = await createInsightsPortalSession({
      userId: authData.user.id,
      returnUrl: `${siteUrl}${returnPath}`,
    });

    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Portal failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
