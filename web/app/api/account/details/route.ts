import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import { resolveAccountTheme } from "@/lib/team-themes";
import { recordLoginDay } from "@/lib/auth/record-login-day";
import { getFplSessionStatus } from "@/lib/auth/fpl-access";

export const dynamic = "force-dynamic";

export async function GET() {
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
    await recordLoginDay(userId);

    const admin = getServerSupabase();

    const [{ data: profile }, { data: prefs }] = await Promise.all([
      admin
        .from("profiles")
        .select(
          "id,display_name,fpl_entry_id,onboarding_completed_at,locale,login_days,theme_team_type",
        )
        .eq("id", userId)
        .maybeSingle(),
      admin.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    let nationalTeam: { code: string; name: string; short_name: string } | null =
      null;
    let fplClub: { id: number; name: string; short_name: string } | null = null;

    if (prefs?.national_team_code) {
      const { data } = await admin
        .from("wc_teams")
        .select("code,name,short_name")
        .eq("code", prefs.national_team_code)
        .maybeSingle();
      if (data) {
        nationalTeam = {
          code: data.code as string,
          name: data.name as string,
          short_name: data.short_name as string,
        };
      }
    }

    if (prefs?.fpl_team_id) {
      const { data } = await admin
        .from("teams")
        .select("id,name,short_name")
        .eq("id", prefs.fpl_team_id)
        .maybeSingle();
      if (data) {
        fplClub = {
          id: data.id as number,
          name: data.name as string,
          short_name: data.short_name as string,
        };
      }
    }

    const fplIds = (prefs?.followed_fpl_player_ids as number[] | undefined) ?? [];
    const wcIds = (prefs?.followed_wc_player_ids as number[] | undefined) ?? [];

    const [{ data: fplPlayers }, { data: wcPlayers }] = await Promise.all([
      fplIds.length
        ? admin
            .from("players_static")
            .select("fpl_id,web_name,name")
            .in("fpl_id", fplIds)
        : Promise.resolve({ data: [] }),
      wcIds.length
        ? admin.from("wc_players").select("id,name").in("id", wcIds)
        : Promise.resolve({ data: [] }),
    ]);

    const themeTeamType =
      (profile?.theme_team_type as "club" | "national" | undefined) ?? "club";
    const theme = resolveAccountTheme({
      themeTeamType,
      fplShortName: fplClub?.short_name ?? null,
      nationalTeamCode: nationalTeam?.code ?? null,
    });

    const fplSession = await getFplSessionStatus(userId);

    return NextResponse.json({
      email: authData.user.email,
      profile: profile ?? {
        id: userId,
        login_days: 0,
        theme_team_type: "club",
        onboarding_completed_at: null,
      },
      fpl_session: fplSession,
      preferences: prefs
        ? {
            national_team: nationalTeam,
            favorite_leagues: prefs.favorite_leagues ?? [],
            fpl_club: fplClub,
            followed_fpl_players: (fplPlayers ?? []).map((p) => ({
              id: p.fpl_id as number,
              name: (p.web_name as string | null) ?? (p.name as string),
            })),
            followed_wc_players: (wcPlayers ?? []).map((p) => ({
              id: p.id as number,
              name: p.name as string,
            })),
            news_regions: prefs.news_regions ?? [],
          }
        : null,
      theme,
      theme_team_type: themeTeamType,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
