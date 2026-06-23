import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import { confirmUserEmail } from "@/lib/auth/confirm-user";
import { recordLoginDay } from "@/lib/auth/record-login-day";

export const dynamic = "force-dynamic";

type Body = { email?: string; password?: string };

export async function POST(request: NextRequest) {
  try {
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const body = (await request.json()) as Body;
    const email = body.email?.trim();
    const password = body.password;
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    }

    const admin = getServerSupabase();
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr && !/already|registered|exists/i.test(createErr.message)) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }

    if (createErr) {
      await confirmUserEmail(email);
    }

    const { supabase: supa, jsonResponse } =
      createSupabaseRouteHandlerClient(request);
    const { error: signInErr } = await supa.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) {
      return jsonResponse({ error: signInErr.message }, { status: 400 });
    }

    const { data: sessionData } = await supa.auth.getUser();
    if (sessionData.user) {
      await recordLoginDay(sessionData.user.id);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sign up failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
