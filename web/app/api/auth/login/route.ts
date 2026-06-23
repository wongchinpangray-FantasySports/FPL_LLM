import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import {
  confirmUserEmail,
  isEmailNotConfirmedError,
} from "@/lib/auth/confirm-user";
import { recordLoginDay } from "@/lib/auth/record-login-day";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { email?: string; password?: string };

export async function POST(request: NextRequest) {
  try {
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const body = (await request.json()) as Body;
    const email = body.email?.trim();
    const password = body.password;
    if (!email || !password) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    }

    const { supabase: supa, jsonResponse } =
      createSupabaseRouteHandlerClient(request);
    let { error: signInErr } = await supa.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr && isEmailNotConfirmedError(signInErr.message)) {
      await confirmUserEmail(email);
      ({ error: signInErr } = await supa.auth.signInWithPassword({
        email,
        password,
      }));
    }

    if (signInErr) {
      return jsonResponse({ error: signInErr.message }, { status: 400 });
    }

    const { data: sessionData } = await supa.auth.getUser();
    if (sessionData.user) {
      await recordLoginDay(sessionData.user.id);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sign in failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
