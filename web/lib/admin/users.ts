import type { User } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase";
import type { AdminUserRow } from "@/lib/admin/types";

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function listAllAuthUsers(): Promise<User[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin user listing.",
    );
  }

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

async function selectInBatches<T extends Record<string, unknown>>(
  table: string,
  columns: string,
  column: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  const admin = getServerSupabase();
  const rows: T[] = [];
  for (const batch of chunk(ids, 100)) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .in(column, batch);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as unknown as T[]));
  }
  return rows;
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const admin = getServerSupabase();
  const authUsers = await listAllAuthUsers();
  if (authUsers.length === 0) return [];

  const ids = authUsers.map((u) => u.id);

  const [profiles, preferences] = await Promise.all([
    selectInBatches<Record<string, unknown>>("profiles", "*", "id", ids),
    selectInBatches<Record<string, unknown>>(
      "user_preferences",
      "*",
      "user_id",
      ids,
    ),
  ]);

  const fplTeamIds = [
    ...new Set(
      preferences
        .map((p) => p.fpl_team_id as number | null)
        .filter((id): id is number => id != null),
    ),
  ];
  const nationalCodes = [
    ...new Set(
      preferences
        .map((p) => p.national_team_code as string | null)
        .filter((code): code is string => Boolean(code)),
    ),
  ];
  const fplPlayerIds = [
    ...new Set(
      preferences.flatMap(
        (p) => (p.followed_fpl_player_ids as number[] | undefined) ?? [],
      ),
    ),
  ];
  const wcPlayerIds = [
    ...new Set(
      preferences.flatMap(
        (p) => (p.followed_wc_player_ids as number[] | undefined) ?? [],
      ),
    ),
  ];

  const [fplTeams, wcTeams, fplPlayers, wcPlayers] = await Promise.all([
    fplTeamIds.length
      ? admin.from("teams").select("id,name,short_name").in("id", fplTeamIds)
      : Promise.resolve({ data: [], error: null }),
    nationalCodes.length
      ? admin
          .from("wc_teams")
          .select("code,name,short_name")
          .in("code", nationalCodes)
      : Promise.resolve({ data: [], error: null }),
    fplPlayerIds.length
      ? admin
          .from("players_static")
          .select("fpl_id,web_name,name")
          .in("fpl_id", fplPlayerIds)
      : Promise.resolve({ data: [], error: null }),
    wcPlayerIds.length
      ? admin.from("wc_players").select("id,name").in("id", wcPlayerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [fplTeams, wcTeams, fplPlayers, wcPlayers]) {
    if (result.error) throw new Error(result.error.message);
  }

  const profileById = new Map(profiles.map((p) => [p.id as string, p]));
  const prefByUser = new Map(
    preferences.map((p) => [p.user_id as string, p]),
  );
  const fplTeamById = new Map(
    (fplTeams.data ?? []).map((t) => [t.id as number, t.name as string]),
  );
  const wcTeamByCode = new Map(
    (wcTeams.data ?? []).map((t) => [t.code as string, t.name as string]),
  );
  const fplPlayerById = new Map(
    (fplPlayers.data ?? []).map((p) => [
      p.fpl_id as number,
      (p.web_name as string) || (p.name as string) || `#${p.fpl_id}`,
    ]),
  );
  const wcPlayerById = new Map(
    (wcPlayers.data ?? []).map((p) => [p.id as number, p.name as string]),
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

  rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return rows;
}
