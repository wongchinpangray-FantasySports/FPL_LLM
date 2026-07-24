import type { SupabaseClient } from "@supabase/supabase-js";
import { fplGet } from "@/lib/fpl";

export type FplClubRow = {
  id: number;
  name: string;
  short_name: string;
};

type PrefsLike = {
  fpl_team_id?: number | null;
  fpl_team_short_name?: string | null;
};

/** Resolve favourite club from stable short code, then legacy numeric id. */
export async function resolveFplClubFromPrefs(
  admin: SupabaseClient,
  prefs: PrefsLike | null | undefined,
): Promise<FplClubRow | null> {
  if (!prefs) return null;

  const shortRaw = prefs.fpl_team_short_name?.trim().toUpperCase();
  if (shortRaw) {
    const { data } = await admin
      .from("teams")
      .select("id,name,short_name")
      .eq("short_name", shortRaw)
      .maybeSingle();
    if (data) {
      return {
        id: data.id as number,
        name: data.name as string,
        short_name: String(data.short_name).toUpperCase(),
      };
    }

    try {
      const bootstrap = await fplGet<{
        teams?: Array<{ id: number; name: string; short_name: string }>;
      }>("/bootstrap-static/");
      const hit = (bootstrap.teams ?? []).find(
        (t) => t.short_name.toUpperCase() === shortRaw,
      );
      if (hit) {
        return {
          id: hit.id,
          name: hit.name,
          short_name: hit.short_name.toUpperCase(),
        };
      }
    } catch {
      /* fall through */
    }
  }

  if (prefs.fpl_team_id != null) {
    const { data } = await admin
      .from("teams")
      .select("id,name,short_name")
      .eq("id", prefs.fpl_team_id)
      .maybeSingle();
    if (data) {
      return {
        id: data.id as number,
        name: data.name as string,
        short_name: String(data.short_name).toUpperCase(),
      };
    }
  }

  return null;
}

export async function resolveFplClubShortName(
  admin: SupabaseClient,
  prefs: PrefsLike | null | undefined,
): Promise<string | null> {
  const club = await resolveFplClubFromPrefs(admin, prefs);
  return club?.short_name ?? null;
}

/** Persist both stable short code and current-season bootstrap id. */
export async function upsertFplClubPreference(
  admin: SupabaseClient,
  userId: string,
  shortName: string,
): Promise<FplClubRow> {
  const code = shortName.trim().toUpperCase();
  if (!code) throw new Error("Club code required");

  const { data: team } = await admin
    .from("teams")
    .select("id,name,short_name")
    .eq("short_name", code)
    .maybeSingle();

  let club: FplClubRow | null = team
    ? {
        id: team.id as number,
        name: team.name as string,
        short_name: String(team.short_name).toUpperCase(),
      }
    : null;

  if (!club) {
    const bootstrap = await fplGet<{
      teams?: Array<{ id: number; name: string; short_name: string }>;
    }>("/bootstrap-static/");
    const hit = (bootstrap.teams ?? []).find(
      (t) => t.short_name.toUpperCase() === code,
    );
    if (!hit) throw new Error(`Unknown club code: ${code}`);
    club = {
      id: hit.id,
      name: hit.name,
      short_name: hit.short_name.toUpperCase(),
    };
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("user_preferences").upsert(
    {
      user_id: userId,
      fpl_team_id: club.id,
      fpl_team_short_name: club.short_name,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);

  return club;
}
