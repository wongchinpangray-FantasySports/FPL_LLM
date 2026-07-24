import { getServerSupabase } from "@/lib/supabase";
import { resolveFplClubShortName } from "@/lib/auth/fpl-club-preference";
import { resolveAccountTheme, type TeamTheme } from "@/lib/team-themes";

export type UserThemePayload = {
  theme: TeamTheme;
  theme_team_type: "club" | "national";
};

export async function resolveUserTheme(userId: string): Promise<UserThemePayload> {
  const admin = getServerSupabase();

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    admin
      .from("profiles")
      .select("theme_team_type")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("user_preferences")
      .select("national_team_code,fpl_team_id,fpl_team_short_name")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const fplShort = await resolveFplClubShortName(admin, prefs);

  const themeTeamType =
    (profile?.theme_team_type as "club" | "national" | undefined) ?? "club";

  return {
    theme_team_type: themeTeamType,
    theme: resolveAccountTheme({
      themeTeamType,
      fplShortName: fplShort,
      nationalTeamCode: (prefs?.national_team_code as string | null) ?? null,
    }),
  };
}
