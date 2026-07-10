import { getServerSupabase } from "@/lib/supabase";
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

export type HistoricalPlayerRow = {
  fpl_id: number;
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
  const season = searchParams.get("season")?.trim() || undefined;
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

export async function listAvailableFplSeasons(): Promise<string[]> {
  const supa = getServerSupabase();
  const { data, error } = await supa.from("fpl_seasons_list").select("season");
  if (error) throw new Error(error.message);
  const seasons = [
    ...new Set(
      (data ?? [])
        .map((r) => (r.season != null ? String(r.season).trim() : ""))
        .filter(Boolean),
    ),
  ].sort((a, b) => Number(b) - Number(a));
  return seasons.length ? seasons : [await getCurrentFplSeason()];
}

export async function loadHistoricalMeta(): Promise<HistoricalMeta> {
  const supa = getServerSupabase();
  const [seasons, activeSeason, teamsRes] = await Promise.all([
    listAvailableFplSeasons(),
    getCurrentFplSeason(),
    supa.from("teams").select("id,name,short_name").order("name"),
  ]);

  const gwBounds: Record<string, { min: number; max: number }> = {};
  await Promise.all(
    seasons.map(async (season) => {
      const [minRes, maxRes] = await Promise.all([
        supa
          .from("player_gw_stats")
          .select("gw")
          .eq("season", season)
          .order("gw", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supa
          .from("player_gw_stats")
          .select("gw")
          .eq("season", season)
          .order("gw", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const minGw = Math.floor(num(minRes.data?.gw));
      const maxGw = Math.floor(num(maxRes.data?.gw));
      gwBounds[season] =
        minGw > 0 && maxGw > 0
          ? { min: minGw, max: maxGw }
          : { min: 1, max: 38 };
    }),
  );

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

async function loadPlayerCandidates(
  params: HistoricalQueryParams,
): Promise<PlayerStatic[]> {
  const supa = getServerSupabase();
  let query = supa.from("players_static").select(PLAYER_COLS);

  if (params.position) query = query.eq("position", params.position);
  if (params.teamId != null && params.teamId > 0) {
    query = query.eq("team_id", params.teamId);
  }
  const name = params.name?.trim();
  if (name && name.length >= 2) {
    query = query.or(`web_name.ilike.%${name}%,name.ilike.%${name}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    fpl_id: Math.floor(num(r.fpl_id)),
    name: String(r.name ?? ""),
    web_name: String(r.web_name ?? r.name ?? ""),
    team: String(r.team ?? ""),
    team_id: r.team_id != null ? Math.floor(num(r.team_id)) : null,
    position: String(r.position ?? ""),
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

  return rows;
}

function aggregateRows(
  players: PlayerStatic[],
  gwRows: GwStatRow[],
): HistoricalPlayerRow[] {
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
    if (!byPlayer.has(row.player_id)) continue;
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

  const out: HistoricalPlayerRow[] = [];
  for (const [playerId, stats] of acc) {
    const meta = byPlayer.get(playerId);
    if (!meta) continue;
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
    const av = a[sortBy];
    const bv = b[sortBy];
    if (av == null && bv == null) return a.web_name.localeCompare(b.web_name);
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av === bv) return a.web_name.localeCompare(b.web_name);
    return av > bv ? dir : -dir;
  });
}

export async function queryHistoricalStats(
  params: HistoricalQueryParams,
): Promise<HistoricalQueryResult> {
  const season = await resolveFplSeasonForTool(params.season);
  if (!isFplSeasonKey(season)) {
    throw new Error("Invalid season");
  }

  const meta = await loadHistoricalMeta();
  const bounds = meta.gwBounds[season] ?? { min: 1, max: 38 };
  const gwFrom = Math.max(
    bounds.min,
    params.gwFrom != null && params.gwFrom > 0 ? params.gwFrom : bounds.min,
  );
  const gwTo = Math.min(
    bounds.max,
    params.gwTo != null && params.gwTo > 0 ? params.gwTo : bounds.max,
  );

  const players = await loadPlayerCandidates(params);
  const playerIds = players.map((p) => p.fpl_id);
  const gwRows = await loadGwStatsForPlayers(
    playerIds,
    season,
    Math.min(gwFrom, gwTo),
    Math.max(gwFrom, gwTo),
  );

  let rows = aggregateRows(players, gwRows);

  if (params.minMinutes != null && params.minMinutes > 0) {
    rows = rows.filter((r) => r.minutes >= params.minMinutes!);
  }
  if (params.minAppearances != null && params.minAppearances > 0) {
    rows = rows.filter((r) => r.appearances >= params.minAppearances!);
  }

  const sortBy = params.sortBy ?? "total_points";
  const sortDir = params.sortDir ?? "desc";
  rows = sortRows(rows, sortBy, sortDir);

  const total = rows.length;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;
  const page = rows.slice(offset, offset + limit);

  return {
    season,
    seasonLabel: seasonLabel(season),
    gwFrom: Math.min(gwFrom, gwTo),
    gwTo: Math.max(gwFrom, gwTo),
    total,
    rows: page,
  };
}
