import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import { resolveAccountTheme } from "@/lib/team-themes";

export const dynamic = "force-dynamic";

type Body = { theme_team_type?: "club" | "national" };

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
    if (body.theme_team_type !== "club" && body.theme_team_type !== "national") {
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
    }

    const userId = authData.user.id;
    const admin = getServerSupabase();

    const { error } = await admin
      .from("profiles")
      .update({ theme_team_type: body.theme_team_type })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    const { data: prefs } = await admin
      .from("user_preferences")
      .select("national_team_code,fpl_team_id")
      .eq("user_id", userId)
      .maybeSingle();

    let fplShort: string | null = null;
    if (prefs?.fpl_team_id) {
      const { data: team } = await admin
        .from("teams")
        .select("short_name")
        .eq("id", prefs.fpl_team_id)
        .maybeSingle();
      fplShort = (team?.short_name as string | null) ?? null;
    }

    const theme = resolveAccountTheme({
      themeTeamType: body.theme_team_type,
      fplShortName: fplShort,
      nationalTeamCode: (prefs?.national_team_code as string | null) ?? null,
    });

    return NextResponse.json({ ok: true, theme_team_type: body.theme_team_type, theme });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update theme";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
