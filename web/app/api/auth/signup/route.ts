import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import { confirmUserEmail } from "@/lib/auth/confirm-user";

export const dynamic = "force-dynamic";

type Body = { email?: string; password?: string };

export async function POST(req: Request) {
  try {
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const body = (await req.json()) as Body;
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

    const supa = createSupabaseServerClient();
    const { error: signInErr } = await supa.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) {
      return NextResponse.json({ error: signInErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sign up failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
