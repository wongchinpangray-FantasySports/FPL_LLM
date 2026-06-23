import { getServerSupabase } from "@/lib/supabase";

export const H2H_HISTORY_LIMIT = 5;

export type H2HMatch = {
  season: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  kickoff: string | null;
};

/** Sorted pair key — any venue (legacy). */
export function h2hPairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

/** Team perspective + venue: ARS:CHE:H = Arsenal home vs Chelsea. */
export function h2hVenueKey(
  team: string,
  opp: string,
  teamWasHome: boolean,
): string {
  return `${team}:${opp}:${teamWasHome ? "H" : "A"}`;
}

export function formatPlSeason(season: string): string {
  const y = Number(season);
  if (!Number.isFinite(y)) return season;
  return `${y}/${String(y + 1).slice(-2)}`;
}

async function loadTeamCodeMap(): Promise<Map<number, string>> {
  const supa = getServerSupabase();
  const { data } = await supa.from("teams").select("id,short_name");
  const out = new Map<number, string>();
  for (const row of data ?? []) {
    const code = String(row.short_name ?? "").trim().toUpperCase();
    if (code) out.set(row.id as number, code);
  }
  return out;
}

async function loadTeamCodeByPlayer(
  teamCodeById: Map<number, string>,
): Promise<Map<number, string>> {
  const supa = getServerSupabase();
  const out = new Map<number, string>();
  const PAGE = 1000;
  let from = 0;

  while (true) {
    const { data } = await supa
      .from("players_static")
      .select("fpl_id,team_id")
      .not("team_id", "is", null)
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    for (const row of data) {
      const code = teamCodeById.get(row.team_id as number);
      if (code) out.set(row.fpl_id as number, code);
    }
    from += PAGE;
    if (data.length < PAGE) break;
  }
  return out;
}

async function loadFinishedDbMatches(
  teamCodeById: Map<number, string>,
): Promise<H2HMatch[]> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("fixtures")
    .select(
      "season,home_team_id,away_team_id,home_team_score,away_team_score,kickoff_time",
    )
    .eq("finished", true)
    .not("home_team_score", "is", null)
    .not("away_team_score", "is", null);

  const out: H2HMatch[] = [];
  for (const row of data ?? []) {
    const home = teamCodeById.get(row.home_team_id as number);
    const away = teamCodeById.get(row.away_team_id as number);
    if (!home || !away || home === away) continue;
    out.push({
      season: String(row.season ?? ""),
      home,
      away,
      homeScore: row.home_team_score as number,
      awayScore: row.away_team_score as number,
      kickoff: (row.kickoff_time as string | null) ?? null,
    });
  }
  return out;
}

type PgsRow = {
  season: string;
  fixture_id: number;
  opponent_team_id: number;
  was_home: boolean;
  goals_scored: number | null;
  goals_conceded: number | null;
  minutes: number | null;
  player_id: number;
};

async function loadPgsRows(): Promise<PgsRow[]> {
  const supa = getServerSupabase();
  const rows: PgsRow[] = [];
  const PAGE = 5000;
  let from = 0;

  while (true) {
    const { data } = await supa
      .from("player_gw_stats")
      .select(
        "season,fixture_id,opponent_team_id,was_home,goals_scored,goals_conceded,minutes,player_id",
      )
      .not("fixture_id", "is", null)
      .gt("minutes", 0)
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    rows.push(...(data as PgsRow[]));
    from += PAGE;
    if (data.length < PAGE) break;
  }
  return rows;
}

function aggregatePgsMatches(
  rows: PgsRow[],
  teamCodeById: Map<number, string>,
  teamCodeByPlayer: Map<number, string>,
  homeOnly: boolean,
): H2HMatch[] {
  type Acc = {
    season: string;
    home: string;
    away: string;
    homeScore: number;
    awayScore: number;
  };

  const byFixture = new Map<string, Acc>();

  for (const row of rows) {
    if (!row.fixture_id || Boolean(row.was_home) !== homeOnly) continue;
    if ((row.minutes ?? 0) <= 0) continue;

    const team = teamCodeByPlayer.get(row.player_id);
    const opp = teamCodeById.get(row.opponent_team_id);
    if (!team || !opp || team === opp) continue;

    const home = homeOnly ? team : opp;
    const away = homeOnly ? opp : team;
    const key = `${row.season}:${row.fixture_id}`;

    let acc = byFixture.get(key);
    if (!acc) {
      acc = {
        season: row.season,
        home,
        away,
        homeScore: 0,
        awayScore: homeOnly ? (row.goals_conceded ?? 0) : 0,
      };
      byFixture.set(key, acc);
    }

    if (homeOnly) {
      acc.homeScore += row.goals_scored ?? 0;
      acc.awayScore = Math.max(acc.awayScore, row.goals_conceded ?? 0);
    } else {
      acc.awayScore += row.goals_scored ?? 0;
      acc.homeScore = Math.max(acc.homeScore, row.goals_conceded ?? 0);
    }
  }

  return [...byFixture.values()].map((m) => ({
    season: m.season,
    home: m.home,
    away: m.away,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    kickoff: null,
  }));
}

function matchDedupeKey(m: H2HMatch): string {
  return `${m.season}:${m.home}:${m.away}:${m.homeScore}:${m.awayScore}`;
}

function matchSortKey(m: H2HMatch): number {
  const season = Number(m.season) || 0;
  const kickoff = m.kickoff ? Date.parse(m.kickoff) : 0;
  return season * 1e12 + kickoff;
}

function pushVenueMatch(
  grouped: Map<string, H2HMatch[]>,
  team: string,
  opp: string,
  teamWasHome: boolean,
  match: H2HMatch,
) {
  const key = h2hVenueKey(team, opp, teamWasHome);
  const list = grouped.get(key) ?? [];
  if (list.some((m) => matchDedupeKey(m) === matchDedupeKey(match))) return;
  list.push(match);
  list.sort((a, b) => matchSortKey(b) - matchSortKey(a));
  grouped.set(key, list.slice(0, H2H_HISTORY_LIMIT));
}

/**
 * Last {H2H_HISTORY_LIMIT} PL meetings per team+opponent+venue.
 * Key: `{team}:{opp}:H` or `{team}:{opp}:A` (from the selected team's perspective).
 */
export async function buildH2HHistoryLookup(): Promise<
  Record<string, H2HMatch[]>
> {
  const teamCodeById = await loadTeamCodeMap();
  const teamCodeByPlayer = await loadTeamCodeByPlayer(teamCodeById);
  const pgsRows = await loadPgsRows();
  const [dbMatches, pgsHome, pgsAway] = await Promise.all([
    loadFinishedDbMatches(teamCodeById),
    Promise.resolve(
      aggregatePgsMatches(pgsRows, teamCodeById, teamCodeByPlayer, true),
    ),
    Promise.resolve(
      aggregatePgsMatches(pgsRows, teamCodeById, teamCodeByPlayer, false),
    ),
  ]);

  const seen = new Set<string>();
  const all: H2HMatch[] = [];

  for (const m of [...dbMatches, ...pgsHome, ...pgsAway]) {
    const key = matchDedupeKey(m);
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(m);
  }

  all.sort((a, b) => matchSortKey(b) - matchSortKey(a));

  const grouped = new Map<string, H2HMatch[]>();
  for (const m of all) {
    pushVenueMatch(grouped, m.home, m.away, true, m);
    pushVenueMatch(grouped, m.away, m.home, false, m);
  }

  return Object.fromEntries(grouped);
}

export function getH2HHistory(
  lookup: Record<string, H2HMatch[]>,
  team: string,
  opp: string,
  teamWasHome: boolean,
): H2HMatch[] {
  return lookup[h2hVenueKey(team, opp, teamWasHome)] ?? [];
}

export type H2HResultForTeam = "W" | "D" | "L";

export function resultForTeam(
  match: H2HMatch,
  team: string,
): H2HResultForTeam {
  const isHome = match.home === team;
  const gf = isHome ? match.homeScore : match.awayScore;
  const ga = isHome ? match.awayScore : match.homeScore;
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
}
