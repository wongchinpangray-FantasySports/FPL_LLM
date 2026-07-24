import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import {
  clearUserFplSessionCookie,
  getFplSessionStatus,
  getUserFplSessionCookie,
  saveUserFplSessionCookie,
  verifyFplSessionForEntry,
} from "@/lib/auth/fpl-access";
import { getUserProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Body = { session_cookie?: string };

export async function POST(req: Request) {
  try {
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const supa = createSupabaseServerClient();
    const { data: authData, error: authError } = await supa.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;
    const profile = await getUserProfile(userId);
    if (!profile?.fpl_entry_id) {
      return NextResponse.json(
        { error: "Link your FPL Entry ID before connecting a session." },
        { status: 400 },
      );
    }

    const body = (await req.json()) as Body;
    const raw = body.session_cookie?.trim();
    if (!raw) {
      return NextResponse.json(
        { error: "Paste your browser Cookie header from fantasy.premierleague.com." },
        { status: 400 },
      );
    }

    await saveUserFplSessionCookie(userId, raw);

    const storedCookie = await getUserFplSessionCookie(userId);
    const ok =
      storedCookie != null &&
      (await verifyFplSessionForEntry(profile.fpl_entry_id, storedCookie));
    if (!ok) {
      await clearUserFplSessionCookie(userId);
      return NextResponse.json(
        {
          error:
            "Could not load your Pick Team with this cookie. Log in on FPL as the manager who owns your linked Entry ID, then copy a fresh Cookie.",
        },
        { status: 400 },
      );
    }

    const status = await getFplSessionStatus(userId);
    return NextResponse.json({ ok: true, ...status });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to connect FPL session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const supa = createSupabaseServerClient();
    const { data: authData, error: authError } = await supa.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await clearUserFplSessionCookie(authData.user.id);
    return NextResponse.json({ ok: true, connected: false, connected_at: null });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to disconnect FPL session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
