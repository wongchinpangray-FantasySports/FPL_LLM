import type { User } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase";

export type AdminOnboardingView = {
  completed_at: string | null;
  skipped: boolean;
  national_team_code: string | null;
  national_team_name: string | null;
  favorite_leagues: string[];
  fpl_team_id: number | null;
  fpl_team_name: string | null;
  followed_fpl_players: { id: number; name: string }[];
  followed_wc_players: { id: number; name: string }[];
  news_regions: string[];
};

export type AdminUserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  fpl_entry_id: number | null;
  locale: string | null;
  login_days: number;
  last_login_date: string | null;
  theme_team_type: string | null;
  onboarding: AdminOnboardingView;
};

async function listAllAuthUsers(): Promise<User[]> {
  const admin = getServerSupabase();
  const out: User[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    out.push(...(data.users ?? []));
    if ((data.users?.length ?? 0) < 200) break;
    page += 1;
  }
  return out;
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const admin = getServerSupabase();
  const authUsers = await listAllAuthUsers();
  if (authUsers.length === 0) return [];

  const ids = authUsers.map((u) => u.id);

  const [
    { data: profiles },
    { data: preferences },
    { data: fplTeams },
    { data: wcTeams },
    { data: fplPlayers },
    { data: wcPlayers },
  ] = await Promise.all([
    admin.from("profiles").select("*").in("id", ids),
    admin.from("user_preferences").select("*").in("user_id", ids),
    admin.from("teams").select("id,name,short_name"),
    admin.from("wc_teams").select("code,name,short_name"),
    admin.from("players_static").select("fpl_id,web_name,name"),
    admin.from("wc_players").select("id,name"),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const prefByUser = new Map(
    (preferences ?? []).map((p) => [p.user_id as string, p]),
  );
  const fplTeamById = new Map(
    (fplTeams ?? []).map((t) => [t.id as number, t.name as string]),
  );
  const wcTeamByCode = new Map(
    (wcTeams ?? []).map((t) => [t.code as string, t.name as string]),
  );
  const fplPlayerById = new Map(
    (fplPlayers ?? []).map((p) => [
      p.fpl_id as number,
      (p.web_name as string) || (p.name as string) || `#${p.fpl_id}`,
    ]),
  );
  const wcPlayerById = new Map(
    (wcPlayers ?? []).map((p) => [p.id as number, p.name as string]),
  );

  const rows: AdminUserRow[] = authUsers.map((u) => {
    const profile = profileById.get(u.id);
    const pref = prefByUser.get(u.id);
    const completedAt =
      (profile?.onboarding_completed_at as string | null) ?? null;
    const skipped = Boolean(completedAt && !pref);

    const fplIds = (pref?.followed_fpl_player_ids as number[] | undefined) ?? [];
    const wcIds = (pref?.followed_wc_player_ids as number[] | undefined) ?? [];
    const nationalCode = (pref?.national_team_code as string | null) ?? null;
    const fplTeamId = (pref?.fpl_team_id as number | null) ?? null;

    return {
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      display_name: (profile?.display_name as string | null) ?? null,
      fpl_entry_id: (profile?.fpl_entry_id as number | null) ?? null,
      locale: (profile?.locale as string | null) ?? null,
      login_days: (profile?.login_days as number | undefined) ?? 0,
      last_login_date: (profile?.last_login_date as string | null) ?? null,
      theme_team_type: (profile?.theme_team_type as string | null) ?? null,
      onboarding: {
        completed_at: completedAt,
        skipped,
        national_team_code: nationalCode,
        national_team_name: nationalCode
          ? (wcTeamByCode.get(nationalCode) ?? nationalCode)
          : null,
        favorite_leagues: (pref?.favorite_leagues as string[] | undefined) ?? [],
        fpl_team_id: fplTeamId,
        fpl_team_name: fplTeamId ? (fplTeamById.get(fplTeamId) ?? null) : null,
        followed_fpl_players: fplIds.map((id) => ({
          id,
          name: fplPlayerById.get(id) ?? `#${id}`,
        })),
        followed_wc_players: wcIds.map((id) => ({
          id,
          name: wcPlayerById.get(id) ?? `#${id}`,
        })),
        news_regions: (pref?.news_regions as string[] | undefined) ?? [],
      },
    };
  });

  rows.sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  return rows;
}
