import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchContext, UserPrefRow } from "@/lib/notifications/match-news";
import { notificationDedupeKey } from "@/lib/notifications/match-results";

export async function loadMatchContext(
  admin: SupabaseClient,
): Promise<MatchContext> {
  const [{ data: wcTeams }, { data: fplTeams }, { data: fplPlayers }, { data: wcPlayers }] =
    await Promise.all([
      admin.from("wc_teams").select("code,name,short_name"),
      admin.from("teams").select("id,name,short_name"),
      admin.from("players_static").select("fpl_id,web_name,name"),
      admin.from("wc_players").select("id,name"),
    ]);

  const wcTeamsByCode = new Map<string, { name: string; short_name: string }>();
  for (const t of wcTeams ?? []) {
    wcTeamsByCode.set(t.code as string, {
      name: t.name as string,
      short_name: t.short_name as string,
    });
  }

  const fplTeamsById = new Map<number, { name: string; short_name: string }>();
  for (const t of fplTeams ?? []) {
    fplTeamsById.set(t.id as number, {
      name: t.name as string,
      short_name: t.short_name as string,
    });
  }

  const fplPlayersById = new Map<number, { web_name: string | null; name: string }>();
  for (const p of fplPlayers ?? []) {
    fplPlayersById.set(p.fpl_id as number, {
      web_name: p.web_name as string | null,
      name: p.name as string,
    });
  }

  const wcPlayersById = new Map<number, { name: string }>();
  for (const p of wcPlayers ?? []) {
    wcPlayersById.set(p.id as number, { name: p.name as string });
  }

  return { wcTeamsByCode, fplTeamsById, fplPlayersById, wcPlayersById };
}

export async function loadUserPreferences(
  admin: SupabaseClient,
): Promise<UserPrefRow[]> {
  const { data, error } = await admin
    .from("user_preferences")
    .select(
      "user_id,national_team_code,favorite_leagues,fpl_team_id,followed_fpl_player_ids,followed_wc_player_ids,news_regions",
    );
  if (error) throw new Error(error.message);
  return (data ?? []) as UserPrefRow[];
}

export async function loadRecentDedupeKeys(
  admin: SupabaseClient,
  sinceIso: string,
  types: string[],
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("user_notifications")
    .select("user_id,href")
    .gte("created_at", sinceIso)
    .in("type", types);
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  for (const n of data ?? []) {
    const key = notificationDedupeKey(n.user_id as string, n.href as string | null);
    if (key) seen.add(key);
  }
  return seen;
}

export type NotificationInsert = {
  user_id: string;
  type: string;
  title: string;
  body: string;
  href: string;
};

export async function insertNotifications(
  admin: SupabaseClient,
  rows: NotificationInsert[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await admin.from("user_notifications").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
