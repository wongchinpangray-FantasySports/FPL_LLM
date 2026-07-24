import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { password?: string };

export async function POST(request: NextRequest) {
  try {
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const body = (await request.json()) as Body;
    const password = body.password;
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    const { supabase, jsonResponse } =
      createSupabaseRouteHandlerClient(request);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "Reset link expired or invalid" }, { status: 401 });
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return jsonResponse({ error: error.message }, { status: 400 });
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
