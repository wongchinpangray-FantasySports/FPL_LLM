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

export function h2hPairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
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

async function loadPgsHomeMatches(
  teamCodeById: Map<number, string>,
  teamCodeByPlayer: Map<number, string>,
): Promise<H2HMatch[]> {
  const supa = getServerSupabase();
  type Row = {
    season: string;
    fixture_id: number;
    opponent_team_id: number;
    was_home: boolean;
    goals_scored: number | null;
    goals_conceded: number | null;
    minutes: number | null;
    player_id: number;
  };

  const rows: Row[] = [];
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
    rows.push(...(data as Row[]));
    from += PAGE;
    if (data.length < PAGE) break;
  }

  type Acc = {
    season: string;
    fixtureId: number;
    home: string;
    away: string;
    homeScore: number;
    awayScore: number;
  };

  const byFixture = new Map<string, Acc>();

  for (const row of rows) {
    if (!row.fixture_id || !row.was_home || (row.minutes ?? 0) <= 0) continue;
    const home = teamCodeByPlayer.get(row.player_id);
    const away = teamCodeById.get(row.opponent_team_id);
    if (!home || !away || home === away) continue;

    const key = `${row.season}:${row.fixture_id}`;
    let acc = byFixture.get(key);
    if (!acc) {
      acc = {
        season: row.season,
        fixtureId: row.fixture_id,
        home,
        away,
        homeScore: 0,
        awayScore: row.goals_conceded ?? 0,
      };
      byFixture.set(key, acc);
    }
    acc.homeScore += row.goals_scored ?? 0;
    acc.awayScore = Math.max(acc.awayScore, row.goals_conceded ?? 0);
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

/** Last {H2H_HISTORY_LIMIT} PL meetings per pair, keyed by sorted codes (e.g. ARS:CHE). */
export async function buildH2HHistoryLookup(): Promise<
  Record<string, H2HMatch[]>
> {
  const teamCodeById = await loadTeamCodeMap();
  const teamCodeByPlayer = await loadTeamCodeByPlayer(teamCodeById);
  const [dbMatches, pgsMatches] = await Promise.all([
    loadFinishedDbMatches(teamCodeById),
    loadPgsHomeMatches(teamCodeById, teamCodeByPlayer),
  ]);

  const seen = new Set<string>();
  const all: H2HMatch[] = [];

  for (const m of [...dbMatches, ...pgsMatches]) {
    const key = matchDedupeKey(m);
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(m);
  }

  all.sort((a, b) => matchSortKey(b) - matchSortKey(a));

  const grouped = new Map<string, H2HMatch[]>();
  for (const m of all) {
    const pair = h2hPairKey(m.home, m.away);
    const list = grouped.get(pair) ?? [];
    if (list.length >= H2H_HISTORY_LIMIT) continue;
    list.push(m);
    grouped.set(pair, list);
  }

  return Object.fromEntries(grouped);
}

export function getH2HHistory(
  lookup: Record<string, H2HMatch[]>,
  teamA: string,
  teamB: string,
): H2HMatch[] {
  return lookup[h2hPairKey(teamA, teamB)] ?? [];
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
