import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import { upsertFplClubPreference } from "@/lib/auth/fpl-club-preference";
import { resolveAccountTheme } from "@/lib/team-themes";

export const dynamic = "force-dynamic";

type Body = { fpl_team_short_name?: string };

export async function PATCH(req: Request) {
  try {
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const supa = createSupabaseServerClient();
    const { data: authData, error: authError } = await supa.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const short = body.fpl_team_short_name?.trim();
    if (!short) {
      return NextResponse.json({ error: "Club required" }, { status: 400 });
    }

    const admin = getServerSupabase();
    const club = await upsertFplClubPreference(admin, authData.user.id, short);

    const { data: profile } = await admin
      .from("profiles")
      .select("theme_team_type")
      .eq("id", authData.user.id)
      .maybeSingle();

    const { data: prefs } = await admin
      .from("user_preferences")
      .select("national_team_code")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    const themeTeamType =
      (profile?.theme_team_type as "club" | "national" | undefined) ?? "club";

    const theme = resolveAccountTheme({
      themeTeamType,
      fplShortName: club.short_name,
      nationalTeamCode: (prefs?.national_team_code as string | null) ?? null,
    });

    return NextResponse.json({
      ok: true,
      fpl_club: club,
      theme,
      theme_team_type: themeTeamType,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update club";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
