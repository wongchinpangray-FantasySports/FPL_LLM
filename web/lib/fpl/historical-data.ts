import { getServerSupabase } from "@/lib/supabase";
import {
  formatOpponents,
  loadPlayerFixturesByGw,
  loadPlayerTeamIdForSeason,
  loadSeasonTeamIdMap,
  loadTeamFixturesByGw,
  mergeFixtureMaps,
  opponentLabel,
  type FixtureSide,
} from "@/lib/fpl/historical-vaastav";
import {
  getCurrentFplSeason,
  isFplSeasonKey,
  resolveFplSeasonForTool,
} from "@/lib/fpl-season";

const POSITIONS = ["GKP", "DEF", "MID", "FWD"] as const;
export type HistoricalPosition = (typeof POSITIONS)[number];

export const HISTORICAL_SORT_FIELDS = [
  "total_points",
  "goals_scored",
  "assists",
  "expected_goals",
  "expected_assists",
  "clean_sheets",
  "minutes",
  "bonus",
  "ict_index",
  "bps",
  "defensive_contribution",
  "points_per90",
  "appearances",
] as const;

export type HistoricalSortField = (typeof HISTORICAL_SORT_FIELDS)[number];

export const HISTORICAL_SEASON_ALL = "ALL";

export function isHistoricalAllSeasons(
  season: string | undefined | null,
): boolean {
  return season?.trim().toUpperCase() === HISTORICAL_SEASON_ALL;
}

export type HistoricalPlayerRow = {
  fpl_id: number;
  season: string;
  seasonLabel: string;
  name: string;
  web_name: string;
  team: string;
  team_id: number | null;
  position: string;
  appearances: number;
  minutes: number;
  total_points: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  bonus: number;
  bps: number;
  expected_goals: number;
  expected_assists: number;
  ict_index: number;
  defensive_contribution: number;
  points_per90: number | null;
  goals_per90: number | null;
  xgi_per90: number | null;
};

export type HistoricalQueryParams = {
  season?: string;
  gwFrom?: number;
  gwTo?: number;
  position?: HistoricalPosition;
  teamId?: number;
  name?: string;
  minMinutes?: number;
  minAppearances?: number;
  sortBy?: HistoricalSortField;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

export type HistoricalQueryResult = {
  season: string;
  seasonLabel: string;
  gwFrom: number;
  gwTo: number;
  total: number;
  rows: HistoricalPlayerRow[];
};

export type HistoricalMeta = {
  seasons: string[];
  activeSeason: string;
  teams: { id: number; name: string; short_name: string }[];
  gwBounds: Record<string, { min: number; max: number }>;
};

const PLAYER_COLS =
  "fpl_id,name,web_name,team,team_id,position";

const GW_COLS = [
  "player_id",
  "gw",
  "minutes",
  "goals_scored",
  "assists",
  "clean_sheets",
  "bonus",
  "bps",
  "expected_goals",
  "expected_assists",
  "total_points",
  "ict_index",
  "defensive_contribution",
].join(",");

const PLAYER_CHUNK = 25;

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function seasonLabel(season: string): string {
  if (isHistoricalAllSeasons(season)) return "All seasons";
  const y = Number(season);
  if (!Number.isFinite(y)) return season;
  return `${season}/${String(y + 1).slice(-2)}`;
}

function sanitizeName(q: string): string {
  return q
    .replace(/%/g, "")
    .replace(/[,*'"`;()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameQueryTokens(raw: string | undefined): string[] {
  const normalized = normalizeSearchText(sanitizeName(raw ?? ""));
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length >= 2);
}

function matchesNameTokens(
  row: { name?: string; web_name?: string; team?: string },
  tokens: string[],
): boolean {
  if (!tokens.length) return true;
  const haystack = normalizeSearchText(
    `${row.web_name ?? ""} ${row.name ?? ""} ${row.team ?? ""}`,
  );
  return tokens.every((token) => haystack.includes(token));
}

function profileMatchesTeam(
  row: { team?: string },
  team: { name: string; short_name: string } | undefined,
): boolean {
  if (!team) return true;
  const playerTeam = normalizeSearchText(row.team ?? "");
  const names = [
    normalizeSearchText(team.name),
    normalizeSearchText(team.short_name),
  ].filter(Boolean);
  return names.some(
    (label) => playerTeam.includes(label) || label.includes(playerTeam),
  );
}

async function fetchAllRows<T extends Record<string, unknown>>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: Error | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
    if (from > 50000) break;
  }
  return rows;
}

function per90(total: number, minutes: number): number | null {
  if (minutes <= 0) return null;
  return Math.round((total / minutes) * 90 * 100) / 100;
}

function parseSortField(raw: unknown): HistoricalSortField {
  if (
    typeof raw === "string" &&
    (HISTORICAL_SORT_FIELDS as readonly string[]).includes(raw)
  ) {
    return raw as HistoricalSortField;
  }
  return "total_points";
}

function parsePosition(raw: unknown): HistoricalPosition | undefined {
  if (
    typeof raw === "string" &&
    (POSITIONS as readonly string[]).includes(raw)
  ) {
    return raw as HistoricalPosition;
  }
  return undefined;
}

export function parseHistoricalQueryParams(
  searchParams: URLSearchParams,
): HistoricalQueryParams {
  const seasonRaw = searchParams.get("season")?.trim();
  const season =
    seasonRaw?.toUpperCase() === HISTORICAL_SEASON_ALL
      ? HISTORICAL_SEASON_ALL
      : seasonRaw || undefined;
  const gwFromRaw = searchParams.get("gwFrom");
  const gwToRaw = searchParams.get("gwTo");
  const teamRaw = searchParams.get("teamId");
  const minMinRaw = searchParams.get("minMinutes");
  const minAppRaw = searchParams.get("minAppearances");
  const limitRaw = searchParams.get("limit");
  const offsetRaw = searchParams.get("offset");

  return {
    season,
    gwFrom: gwFromRaw != null ? Math.floor(num(gwFromRaw)) : undefined,
    gwTo: gwToRaw != null ? Math.floor(num(gwToRaw)) : undefined,
    position: parsePosition(searchParams.get("position")),
    teamId:
      teamRaw != null && Number.isFinite(Number(teamRaw))
        ? Math.floor(Number(teamRaw))
        : undefined,
    name: sanitizeName(searchParams.get("name") ?? ""),
    minMinutes:
      minMinRaw != null && Number.isFinite(Number(minMinRaw))
        ? Math.max(0, Math.floor(Number(minMinRaw)))
        : undefined,
    minAppearances:
      minAppRaw != null && Number.isFinite(Number(minAppRaw))
        ? Math.max(0, Math.floor(Number(minAppRaw)))
        : undefined,
    sortBy: parseSortField(searchParams.get("sortBy")),
    sortDir: searchParams.get("sortDir") === "asc" ? "asc" : "desc",
    limit:
      limitRaw != null && Number.isFinite(Number(limitRaw))
        ? Math.min(Math.max(Math.floor(Number(limitRaw)), 1), 200)
        : 50,
    offset:
      offsetRaw != null && Number.isFinite(Number(offsetRaw))
        ? Math.max(0, Math.floor(Number(offsetRaw)))
        : 0,
  };
}

function dedupeSeasons(rows: { season?: unknown }[]): string[] {
  return [
    ...new Set(
      rows
        .map((r) => (r.season != null ? String(r.season).trim() : ""))
        .filter(Boolean),
    ),
  ].sort((a, b) => Number(b) - Number(a));
}

async function fetchSeasonsFromFixtures(): Promise<string[]> {
  const supa = getServerSupabase();
  const { data, error } = await supa.from("fixtures").select("season");
  if (error || !data?.length) return [];
  return dedupeSeasons(data);
}

async function fetchSeasonsFromProfiles(): Promise<string[]> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("player_season_profiles")
    .select("season");
  if (error || !data?.length) return [];
  return dedupeSeasons(data);
}

async function fetchSeasonsFromGwStats(): Promise<string[]> {
  const supa = getServerSupabase();
  const seasons = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supa
      .from("player_gw_stats")
      .select("season")
      .range(from, from + pageSize - 1);
    if (error || !data?.length) break;
    for (const row of data) {
      const s = row.season != null ? String(row.season).trim() : "";
      if (s) seasons.add(s);
    }
    if (data.length < pageSize) break;
    from += pageSize;
    if (from > 20000) break;
  }
  return [...seasons].sort((a, b) => Number(b) - Number(a));
}

export async function listAvailableFplSeasons(): Promise<string[]> {
  const supa = getServerSupabase();
  const { data, error } = await supa.from("fpl_seasons_list").select("season");
  if (!error && data?.length) {
    const seasons = dedupeSeasons(data);
    if (seasons.length) return seasons;
  }

  const merged = new Set<string>([
    ...(await fetchSeasonsFromFixtures()),
    ...(await fetchSeasonsFromProfiles()),
    ...(await fetchSeasonsFromGwStats()),
  ]);
  if (merged.size) {
    return [...merged].sort((a, b) => Number(b) - Number(a));
  }

  return [await getCurrentFplSeason()];
}

async function loadGwBounds(
  seasons: string[],
): Promise<Record<string, { min: number; max: number }>> {
  const supa = getServerSupabase();
  const bounds: Record<string, { min: number; max: number }> = {};

  const { data, error } = await supa.from("fixtures").select("season,gw");
  if (!error && data?.length) {
    for (const row of data) {
      const season = String(row.season ?? "").trim();
      const gw = Math.floor(num(row.gw));
      if (!season || gw <= 0) continue;
      const cur = bounds[season];
      if (!cur) {
        bounds[season] = { min: gw, max: gw };
      } else {
        cur.min = Math.min(cur.min, gw);
        cur.max = Math.max(cur.max, gw);
      }
    }
  }

  for (const season of seasons) {
    if (!bounds[season]) bounds[season] = { min: 1, max: 38 };
  }

  return bounds;
}

export async function loadHistoricalMeta(): Promise<HistoricalMeta> {
  const supa = getServerSupabase();
  const [seasons, activeSeason, teamsRes] = await Promise.all([
    listAvailableFplSeasons(),
    getCurrentFplSeason(),
    supa.from("teams").select("id,name,short_name").order("name"),
  ]);

  const gwBounds = await loadGwBounds(seasons);

  return {
    seasons,
    activeSeason,
    teams: (teamsRes.data ?? []).map((t) => ({
      id: Math.floor(num(t.id)),
      name: String(t.name ?? ""),
      short_name: String(t.short_name ?? ""),
    })),
    gwBounds,
  };
}

type PlayerStatic = {
  fpl_id: number;
  name: string;
  web_name: string;
  team: string;
  team_id: number | null;
  position: string;
};

type GwStatRow = {
  player_id: number;
  gw: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  bonus: number;
  bps: number;
  expected_goals: number;
  expected_assists: number;
  total_points: number;
  ict_index: number;
  defensive_contribution: number;
};

type GwStatDetailRow = GwStatRow & {
  opponent_team_id: number | null;
  was_home: boolean | null;
};

const GW_SUM_FIELDS: (keyof GwStatRow)[] = [
  "minutes",
  "goals_scored",
  "assists",
  "clean_sheets",
  "bonus",
  "bps",
  "expected_goals",
  "expected_assists",
  "total_points",
  "ict_index",
  "defensive_contribution",
];

function dedupeGwStatRows<T extends GwStatRow>(rows: T[]): T[] {
  const deduped = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.player_id}:${row.gw}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, { ...row });
      continue;
    }
    for (const field of GW_SUM_FIELDS) {
      (existing as GwStatRow)[field] = num(existing[field]) + num(row[field]);
    }
    if ("opponent_team_id" in row && "opponent_team_id" in existing) {
      const detail = existing as unknown as GwStatDetailRow;
      const incoming = row as unknown as GwStatDetailRow;
      if (detail.opponent_team_id == null && incoming.opponent_team_id != null) {
        detail.opponent_team_id = incoming.opponent_team_id;
      }
      if (detail.was_home == null && incoming.was_home != null) {
        detail.was_home = incoming.was_home;
      }
    }
  }
  return [...deduped.values()];
}

async function loadPlayerGwStatsDetail(
  fplId: number,
  season: string,
  gwFrom: number,
  gwTo: number,
): Promise<GwStatDetailRow[]> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("player_gw_stats")
    .select(`${GW_COLS},opponent_team_id,was_home`)
    .eq("season", season)
    .eq("player_id", fplId)
    .gte("gw", gwFrom)
    .lte("gw", gwTo)
    .order("gw", { ascending: true });

  if (error) throw new Error(error.message);
  const mapped = (data ?? []).map((raw) => {
    const r = raw as unknown as Record<string, unknown>;
    return {
      player_id: Math.floor(num(r.player_id)),
      gw: Math.floor(num(r.gw)),
      minutes: num(r.minutes),
      goals_scored: num(r.goals_scored),
      assists: num(r.assists),
      clean_sheets: num(r.clean_sheets),
      bonus: num(r.bonus),
      bps: num(r.bps),
      expected_goals: num(r.expected_goals),
      expected_assists: num(r.expected_assists),
      total_points: num(r.total_points),
      ict_index: num(r.ict_index),
      defensive_contribution: num(r.defensive_contribution),
      opponent_team_id:
        r.opponent_team_id != null ? Math.floor(num(r.opponent_team_id)) : null,
      was_home:
        typeof r.was_home === "boolean"
          ? r.was_home
          : r.was_home === "true"
            ? true
            : r.was_home === "false"
              ? false
              : null,
    };
  });
  return dedupeGwStatRows(mapped);
}

function emptyGameweekStats() {
  return {
    minutes: 0,
    total_points: 0,
    goals_scored: 0,
    assists: 0,
    clean_sheets: 0,
    bonus: 0,
    bps: 0,
    expected_goals: 0,
    expected_assists: 0,
    ict_index: 0,
    defensive_contribution: 0,
  };
}

async function loadTeamFixturesFromDb(
  season: string,
  teamId: number,
): Promise<Map<number, FixtureSide[]>> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("fixtures")
    .select("gw,home_team_id,away_team_id")
    .eq("season", season);

  const map = new Map<number, FixtureSide[]>();
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const gw = Math.floor(num(row.gw));
    const home = Math.floor(num(row.home_team_id));
    const away = Math.floor(num(row.away_team_id));
    if (!gw || !home || !away) continue;

    if (home === teamId) {
      const list = map.get(gw) ?? [];
      list.push({ opponentId: away, wasHome: true });
      map.set(gw, list);
    } else if (away === teamId) {
      const list = map.get(gw) ?? [];
      list.push({ opponentId: home, wasHome: false });
      map.set(gw, list);
    }
  }
  return map;
}

function resolveGameweekFixtures(
  gw: number,
  teamFixtures: Map<number, FixtureSide[]>,
  playerFixtures: Map<number, FixtureSide[]>,
): FixtureSide[] {
  const player = playerFixtures.get(gw) ?? [];
  if (player.length) return player;
  return teamFixtures.get(gw) ?? [];
}

function isDoubleGameweek(
  fixtures: FixtureSide[],
  minutes: number | undefined,
): boolean {
  if (fixtures.length >= 2) return true;
  return (minutes ?? 0) > 90;
}

type TeamRow = { id: number; name: string; short_name: string };

async function seasonUsesProfiles(season: string): Promise<boolean> {
  const supa = getServerSupabase();
  const { count, error } = await supa
    .from("player_season_profiles")
    .select("player_id", { count: "exact", head: true })
    .eq("season", season);
  if (error) return false;
  return (count ?? 0) > 0;
}

async function loadPlayerStaticForSeason(
  fplId: number,
  season: string,
): Promise<PlayerStatic | null> {
  const supa = getServerSupabase();
  const useProfiles = await seasonUsesProfiles(season);

  if (useProfiles) {
    const { data, error } = await supa
      .from("player_season_profiles")
      .select("player_id,web_name,name,team,position")
      .eq("season", season)
      .eq("player_id", fplId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      return {
        fpl_id: Math.floor(num(data.player_id)),
        name: String(data.name ?? ""),
        web_name: String(data.web_name ?? data.name ?? ""),
        team: String(data.team ?? ""),
        team_id: null,
        position: String(data.position ?? ""),
      };
    }
    return null;
  }

  const { data: staticRow, error: staticErr } = await supa
    .from("players_static")
    .select(PLAYER_COLS)
    .eq("fpl_id", fplId)
    .maybeSingle();
  if (staticErr) throw new Error(staticErr.message);
  if (staticRow) {
    return {
      fpl_id: Math.floor(num(staticRow.fpl_id)),
      name: String(staticRow.name ?? ""),
      web_name: String(staticRow.web_name ?? staticRow.name ?? ""),
      team: String(staticRow.team ?? ""),
      team_id:
        staticRow.team_id != null ? Math.floor(num(staticRow.team_id)) : null,
      position: String(staticRow.position ?? ""),
    };
  }

  return null;
}

async function loadPlayerCandidates(
  params: HistoricalQueryParams,
  season: string,
  teams: TeamRow[],
): Promise<PlayerStatic[]> {
  const supa = getServerSupabase();
  const useProfiles = await seasonUsesProfiles(season);
  const tokens = nameQueryTokens(params.name);
  const team =
    params.teamId != null && params.teamId > 0
      ? teams.find((t) => t.id === params.teamId)
      : undefined;

  if (useProfiles) {
    const rows = await fetchAllRows<Record<string, unknown>>(async (from, to) => {
      const { data, error } = await supa
        .from("player_season_profiles")
        .select("player_id,web_name,name,team,position")
        .eq("season", season)
        .range(from, to);
      return {
        data: (data ?? []) as Record<string, unknown>[],
        error: error ? new Error(error.message) : null,
      };
    });

    return rows
      .filter(
        (row) =>
          !params.position || String(row.position ?? "") === params.position,
      )
      .filter((row) => profileMatchesTeam(row, team))
      .filter((row) =>
        matchesNameTokens(
          {
            name: String(row.name ?? ""),
            web_name: String(row.web_name ?? row.name ?? ""),
            team: String(row.team ?? ""),
          },
          tokens,
        ),
      )
      .map((row) => ({
        fpl_id: Math.floor(num(row.player_id)),
        name: String(row.name ?? ""),
        web_name: String(row.web_name ?? row.name ?? ""),
        team: String(row.team ?? ""),
        team_id: null,
        position: String(row.position ?? ""),
      }));
  }

  const rows = await fetchAllRows<Record<string, unknown>>(async (from, to) => {
    const { data, error } = await supa
      .from("players_static")
      .select(PLAYER_COLS)
      .range(from, to);
    return {
      data: (data ?? []) as Record<string, unknown>[],
      error: error ? new Error(error.message) : null,
    };
  });

  return rows
    .filter(
      (row) => !params.position || String(row.position ?? "") === params.position,
    )
    .filter((row) => {
      if (!team) return true;
      const teamId =
        row.team_id != null ? Math.floor(num(row.team_id)) : null;
      return teamId === team.id;
    })
    .filter((row) =>
      matchesNameTokens(
        {
          name: String(row.name ?? ""),
          web_name: String(row.web_name ?? row.name ?? ""),
          team: String(row.team ?? ""),
        },
        tokens,
      ),
    )
    .map((row) => ({
      fpl_id: Math.floor(num(row.fpl_id)),
      name: String(row.name ?? ""),
      web_name: String(row.web_name ?? row.name ?? ""),
      team: String(row.team ?? ""),
      team_id: row.team_id != null ? Math.floor(num(row.team_id)) : null,
      position: String(row.position ?? ""),
    }));
}

async function loadPlayerCandidatesGroupedBySeason(
  params: HistoricalQueryParams,
  teams: TeamRow[],
): Promise<Map<string, PlayerStatic[]>> {
  const supa = getServerSupabase();
  const tokens = nameQueryTokens(params.name);
  const team =
    params.teamId != null && params.teamId > 0
      ? teams.find((t) => t.id === params.teamId)
      : undefined;

  const rows = await fetchAllRows<Record<string, unknown>>(async (from, to) => {
    const { data, error } = await supa
      .from("player_season_profiles")
      .select("player_id,season,web_name,name,team,position")
      .range(from, to);
    return {
      data: (data ?? []) as Record<string, unknown>[],
      error: error ? new Error(error.message) : null,
    };
  });

  const grouped = new Map<string, PlayerStatic[]>();
  for (const row of rows) {
    const season = String(row.season ?? "").trim();
    if (!season) continue;
    if (params.position && String(row.position ?? "") !== params.position) {
      continue;
    }
    if (!profileMatchesTeam(row, team)) continue;
    if (
      !matchesNameTokens(
        {
          name: String(row.name ?? ""),
          web_name: String(row.web_name ?? row.name ?? ""),
          team: String(row.team ?? ""),
        },
        tokens,
      )
    ) {
      continue;
    }

    const player: PlayerStatic = {
      fpl_id: Math.floor(num(row.player_id)),
      name: String(row.name ?? ""),
      web_name: String(row.web_name ?? row.name ?? ""),
      team: String(row.team ?? ""),
      team_id: null,
      position: String(row.position ?? ""),
    };
    const bucket = grouped.get(season);
    if (bucket) bucket.push(player);
    else grouped.set(season, [player]);
  }

  return grouped;
}

async function loadHistoricalTeams(): Promise<TeamRow[]> {
  const supa = getServerSupabase();
  const { data, error } = await supa.from("teams").select("id,name,short_name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    id: Math.floor(num(t.id)),
    name: String(t.name ?? ""),
    short_name: String(t.short_name ?? ""),
  }));
}

async function loadGwStatsForPlayers(
  playerIds: number[],
  season: string,
  gwFrom: number,
  gwTo: number,
): Promise<GwStatRow[]> {
  if (!playerIds.length) return [];

  const supa = getServerSupabase();
  const rows: GwStatRow[] = [];

  for (let i = 0; i < playerIds.length; i += PLAYER_CHUNK) {
    const chunk = playerIds.slice(i, i + PLAYER_CHUNK);
    const { data, error } = await supa
      .from("player_gw_stats")
      .select(GW_COLS)
      .eq("season", season)
      .gte("gw", gwFrom)
      .lte("gw", gwTo)
      .in("player_id", chunk);

    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const r = raw as unknown as Record<string, unknown>;
      rows.push({
        player_id: Math.floor(num(r.player_id)),
        gw: Math.floor(num(r.gw)),
        minutes: num(r.minutes),
        goals_scored: num(r.goals_scored),
        assists: num(r.assists),
        clean_sheets: num(r.clean_sheets),
        bonus: num(r.bonus),
        bps: num(r.bps),
        expected_goals: num(r.expected_goals),
        expected_assists: num(r.expected_assists),
        total_points: num(r.total_points),
        ict_index: num(r.ict_index),
        defensive_contribution: num(r.defensive_contribution),
      });
    }
  }

  return dedupeGwStatRows(rows);
}

type HistoricalPlayerStatsRow = Omit<
  HistoricalPlayerRow,
  "season" | "seasonLabel"
>;

function filterHistoricalRows(
  rows: HistoricalPlayerStatsRow[],
  params: HistoricalQueryParams,
): HistoricalPlayerStatsRow[] {
  const tokens = nameQueryTokens(params.name);
  let filtered = rows;
  if (tokens.length) {
    filtered = filtered.filter((row) => matchesNameTokens(row, tokens));
  }
  if (params.minMinutes != null && params.minMinutes > 0) {
    filtered = filtered.filter((r) => r.minutes >= params.minMinutes!);
  }
  if (params.minAppearances != null && params.minAppearances > 0) {
    filtered = filtered.filter((r) => r.appearances >= params.minAppearances!);
  }
  return filtered;
}

function aggregateRows(
  players: PlayerStatic[],
  gwRows: GwStatRow[],
): HistoricalPlayerStatsRow[] {
  const byPlayer = new Map<number, PlayerStatic>();
  for (const p of players) byPlayer.set(p.fpl_id, p);

  const acc = new Map<
    number,
    {
      appearances: number;
      minutes: number;
      total_points: number;
      goals_scored: number;
      assists: number;
      clean_sheets: number;
      bonus: number;
      bps: number;
      expected_goals: number;
      expected_assists: number;
      ict_index: number;
      defensive_contribution: number;
    }
  >();

  for (const row of gwRows) {
    let bucket = acc.get(row.player_id);
    if (!bucket) {
      bucket = {
        appearances: 0,
        minutes: 0,
        total_points: 0,
        goals_scored: 0,
        assists: 0,
        clean_sheets: 0,
        bonus: 0,
        bps: 0,
        expected_goals: 0,
        expected_assists: 0,
        ict_index: 0,
        defensive_contribution: 0,
      };
      acc.set(row.player_id, bucket);
    }
    if (row.minutes > 0) bucket.appearances += 1;
    bucket.minutes += row.minutes;
    bucket.total_points += row.total_points;
    bucket.goals_scored += row.goals_scored;
    bucket.assists += row.assists;
    bucket.clean_sheets += row.clean_sheets;
    bucket.bonus += row.bonus;
    bucket.bps += row.bps;
    bucket.expected_goals += row.expected_goals;
    bucket.expected_assists += row.expected_assists;
    bucket.ict_index += row.ict_index;
    bucket.defensive_contribution += row.defensive_contribution;
  }

  const out: HistoricalPlayerStatsRow[] = [];
  for (const [playerId, stats] of acc) {
    const meta = byPlayer.get(playerId) ?? {
      fpl_id: playerId,
      name: `#${playerId}`,
      web_name: `#${playerId}`,
      team: "",
      team_id: null,
      position: "",
    };
    const xgi = stats.expected_goals + stats.expected_assists;
    out.push({
      fpl_id: playerId,
      name: meta.name,
      web_name: meta.web_name,
      team: meta.team,
      team_id: meta.team_id,
      position: meta.position,
      appearances: stats.appearances,
      minutes: stats.minutes,
      total_points: stats.total_points,
      goals_scored: stats.goals_scored,
      assists: stats.assists,
      clean_sheets: stats.clean_sheets,
      bonus: stats.bonus,
      bps: stats.bps,
      expected_goals: Math.round(stats.expected_goals * 100) / 100,
      expected_assists: Math.round(stats.expected_assists * 100) / 100,
      ict_index: Math.round(stats.ict_index * 10) / 10,
      defensive_contribution: stats.defensive_contribution,
      points_per90: per90(stats.total_points, stats.minutes),
      goals_per90: per90(stats.goals_scored, stats.minutes),
      xgi_per90: per90(xgi, stats.minutes),
    });
  }

  return out;
}

function sortRows(
  rows: HistoricalPlayerRow[],
  sortBy: HistoricalSortField,
  sortDir: "asc" | "desc",
): HistoricalPlayerRow[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const seasonCmp = b.season.localeCompare(a.season);
    if (seasonCmp !== 0) return seasonCmp;

    const av = a[sortBy];
    const bv = b[sortBy];
    if (av == null && bv == null) return a.web_name.localeCompare(b.web_name);
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av === bv) return a.web_name.localeCompare(b.web_name);
    return av > bv ? dir : -dir;
  });
}

async function queryHistoricalStatsForSeason(
  season: string,
  params: HistoricalQueryParams,
  options?: { players?: PlayerStatic[]; teams?: TeamRow[] },
): Promise<{ gwFrom: number; gwTo: number; rows: HistoricalPlayerRow[] }> {
  if (!isFplSeasonKey(season)) {
    throw new Error("Invalid season");
  }

  const activeSeason = await getCurrentFplSeason();
  const gwBounds = await loadGwBounds([season, activeSeason]);
  const bounds = gwBounds[season] ?? { min: 1, max: 38 };
  const gwFrom = Math.max(
    bounds.min,
    params.gwFrom != null && params.gwFrom > 0 ? params.gwFrom : bounds.min,
  );
  const gwTo = Math.min(
    bounds.max,
    params.gwTo != null && params.gwTo > 0 ? params.gwTo : bounds.max,
  );

  const teams = options?.teams ?? (await loadHistoricalTeams());
  const players =
    options?.players ??
    (await loadPlayerCandidates(params, season, teams));
  const playerIds = players.map((p) => p.fpl_id);
  const gwRows = await loadGwStatsForPlayers(
    playerIds,
    season,
    Math.min(gwFrom, gwTo),
    Math.max(gwFrom, gwTo),
  );

  let rows = filterHistoricalRows(aggregateRows(players, gwRows), params);

  return {
    gwFrom: Math.min(gwFrom, gwTo),
    gwTo: Math.max(gwFrom, gwTo),
    rows: rows.map((row) => ({
      ...row,
      season,
      seasonLabel: seasonLabel(season),
    })),
  };
}

async function resolvePlayerDetailSeason(
  fplId: number,
  gwFromInput: number | undefined,
  gwToInput: number | undefined,
): Promise<string> {
  const seasons = await listAvailableFplSeasons();
  const lo = gwFromInput != null && gwFromInput > 0 ? gwFromInput : 1;
  const hi = gwToInput != null && gwToInput > 0 ? gwToInput : 38;
  for (const season of seasons) {
    const rows = await loadPlayerGwStatsDetail(
      fplId,
      season,
      Math.min(lo, hi),
      Math.max(lo, hi),
    );
    if (rows.length) return season;
  }
  return getCurrentFplSeason();
}

export async function queryHistoricalStats(
  params: HistoricalQueryParams,
): Promise<HistoricalQueryResult> {
  const sortBy = params.sortBy ?? "total_points";
  const sortDir = params.sortDir ?? "desc";
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;

  if (isHistoricalAllSeasons(params.season)) {
    const seasons = await listAvailableFplSeasons();
    const tokens = nameQueryTokens(params.name);
    let gwFrom = 1;
    let gwTo = 38;
    const allRows: HistoricalPlayerRow[] = [];

    if (tokens.length) {
      const teams = await loadHistoricalTeams();
      const grouped = await loadPlayerCandidatesGroupedBySeason(params, teams);
      for (const season of seasons) {
        const players = grouped.get(season) ?? [];
        if (!players.length) continue;
        const result = await queryHistoricalStatsForSeason(season, params, {
          players,
          teams,
        });
        gwFrom = Math.min(gwFrom, result.gwFrom);
        gwTo = Math.max(gwTo, result.gwTo);
        allRows.push(...result.rows);
      }
    } else {
      for (const season of seasons) {
        const result = await queryHistoricalStatsForSeason(season, params);
        gwFrom = Math.min(gwFrom, result.gwFrom);
        gwTo = Math.max(gwTo, result.gwTo);
        allRows.push(...result.rows);
      }
    }

    let rows = sortRows(allRows, sortBy, sortDir);
    const total = rows.length;
    const page = rows.slice(offset, offset + limit);

    return {
      season: HISTORICAL_SEASON_ALL,
      seasonLabel: seasonLabel(HISTORICAL_SEASON_ALL),
      gwFrom,
      gwTo,
      total,
      rows: page,
    };
  }

  const season = await resolveFplSeasonForTool(params.season);
  const { gwFrom, gwTo, rows: unsorted } =
    await queryHistoricalStatsForSeason(season, params);
  let rows = sortRows(unsorted, sortBy, sortDir);

  const total = rows.length;
  const page = rows.slice(offset, offset + limit);

  return {
    season,
    seasonLabel: seasonLabel(season),
    gwFrom,
    gwTo,
    total,
    rows: page,
  };
}

export type HistoricalGameweekRow = {
  gw: number;
  kind: "played" | "bgw";
  isDgw: boolean;
  opponent: string;
  minutes: number;
  total_points: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  bonus: number;
  bps: number;
  expected_goals: number;
  expected_assists: number;
  ict_index: number;
  defensive_contribution: number;
};

export type HistoricalPlayerDetail = {
  season: string;
  seasonLabel: string;
  gwFrom: number;
  gwTo: number;
  summary: HistoricalPlayerRow;
  gameweeks: HistoricalGameweekRow[];
  hasCurrentProfile: boolean;
};

export async function loadHistoricalPlayerDetail(
  fplId: number,
  seasonInput: string | undefined,
  gwFromInput: number | undefined,
  gwToInput: number | undefined,
): Promise<HistoricalPlayerDetail | null> {
  if (!Number.isFinite(fplId) || fplId <= 0) return null;

  const season = isHistoricalAllSeasons(seasonInput)
    ? await resolvePlayerDetailSeason(fplId, gwFromInput, gwToInput)
    : await resolveFplSeasonForTool(seasonInput);
  if (!isFplSeasonKey(season)) return null;

  const activeSeason = await getCurrentFplSeason();
  const gwBounds = await loadGwBounds([season, activeSeason]);
  const bounds = gwBounds[season] ?? { min: 1, max: 38 };
  const gwFrom = Math.max(
    bounds.min,
    gwFromInput != null && gwFromInput > 0 ? gwFromInput : bounds.min,
  );
  const gwTo = Math.min(
    bounds.max,
    gwToInput != null && gwToInput > 0 ? gwToInput : bounds.max,
  );
  const lo = Math.min(gwFrom, gwTo);
  const hi = Math.max(gwFrom, gwTo);

  const supa = getServerSupabase();
  let player = await loadPlayerStaticForSeason(fplId, season);
  const gwRows = await loadPlayerGwStatsDetail(fplId, season, lo, hi);
  if (!player && gwRows.length) {
    player = {
      fpl_id: fplId,
      name: `#${fplId}`,
      web_name: `#${fplId}`,
      team: "",
      team_id: null,
      position: "",
    };
  }
  if (!player) return null;

  const aggregated = aggregateRows([player], gwRows);
  const stats = aggregated[0];
  if (!stats) return null;
  const summary: HistoricalPlayerRow = {
    ...stats,
    season,
    seasonLabel: seasonLabel(season),
  };

  const [teamMap, playerTeamId, playerFixturesByGw] = await Promise.all([
    loadSeasonTeamIdMap(season),
    loadPlayerTeamIdForSeason(season, fplId),
    loadPlayerFixturesByGw(season, fplId),
  ]);
  let teamFixtures =
    playerTeamId != null
      ? await loadTeamFixturesByGw(season, playerTeamId)
      : new Map<number, FixtureSide[]>();
  if (playerTeamId != null) {
    const dbFixtures = await loadTeamFixturesFromDb(season, playerTeamId);
    teamFixtures = mergeFixtureMaps(teamFixtures, dbFixtures);
  }
  const hasFixtureCalendar = teamFixtures.size > 0;

  const gwByNumber = new Map<number, GwStatDetailRow>();
  for (const row of gwRows) gwByNumber.set(row.gw, row);

  const gameweeks: HistoricalGameweekRow[] = [];
  for (let gw = lo; gw <= hi; gw++) {
    const fixtures = resolveGameweekFixtures(
      gw,
      teamFixtures,
      playerFixturesByGw,
    );
    const isBgw = hasFixtureCalendar && fixtures.length === 0;
    const played = gwByNumber.get(gw);

    if (played) {
      const opponent = fixtures.length
        ? formatOpponents(teamMap, fixtures)
        : opponentLabel(teamMap, played.opponent_team_id, played.was_home);
      gameweeks.push({
        gw,
        kind: "played",
        isDgw: isDoubleGameweek(fixtures, played.minutes),
        opponent,
        minutes: played.minutes,
        total_points: played.total_points,
        goals_scored: played.goals_scored,
        assists: played.assists,
        clean_sheets: played.clean_sheets,
        bonus: played.bonus,
        bps: played.bps,
        expected_goals: Math.round(played.expected_goals * 100) / 100,
        expected_assists: Math.round(played.expected_assists * 100) / 100,
        ict_index: Math.round(played.ict_index * 10) / 10,
        defensive_contribution: played.defensive_contribution,
      });
      continue;
    }

    if (isBgw) {
      gameweeks.push({
        gw,
        kind: "bgw",
        isDgw: false,
        opponent: "—",
        ...emptyGameweekStats(),
      });
    }
  }

  const { count } = await supa
    .from("players_static")
    .select("fpl_id", { count: "exact", head: true })
    .eq("fpl_id", fplId);

  return {
    season,
    seasonLabel: seasonLabel(season),
    gwFrom: lo,
    gwTo: hi,
    summary,
    gameweeks,
    hasCurrentProfile: (count ?? 0) > 0,
  };
}
