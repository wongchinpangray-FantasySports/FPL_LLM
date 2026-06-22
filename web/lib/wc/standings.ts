import { isWcMatchFinished } from "@/lib/wc/fifa-rounds";
import { loadWcMatchesForDisplay } from "@/lib/wc/match-stats-store";
import {
  buildGroupTablesFromFifaMatches,
  buildLeaderboardsFromFifaMatches,
  buildTeamResultsFromFifa,
  loadTeamsByCode,
} from "@/lib/wc/fifa-standings";
import { localizeLeaderboardRows } from "@/lib/wc/localize-players";
import type { WcFixtureRow } from "@/lib/wc/projection-context";
import type { WcTeam } from "@/lib/wc/types";
import { unstable_cache } from "next/cache";

export type GroupStandingRow = {
  team_id: number;
  code: string;
  name: string;
  short_name: string;
  group_letter: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  rank: number;
};

export type GroupTable = {
  group_letter: string;
  rows: GroupStandingRow[];
};

export type LeaderboardRow = {
  player_id: number;
  name: string;
  team_code: string;
  team_name: string;
  position: string;
  goals: number;
  assists: number;
};

export type TeamResultRow = {
  matchday: number;
  opponent_code: string;
  opponent_name: string;
  home: boolean;
  score: string | null;
  points: number | null;
};

export type TeamDetail = {
  team_id: number;
  code: string;
  name: string;
  short_name: string;
  group_letter: string;
  attack_strength: number;
  defence_strength: number;
  standing: GroupStandingRow | null;
  results: TeamResultRow[];
};

export function emptyStanding(team: WcTeam): Omit<GroupStandingRow, "rank"> {
  return {
    team_id: team.id,
    code: team.code,
    name: team.name,
    short_name: team.short_name,
    group_letter: team.group_letter,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  };
}

export function applyResult(
  row: Omit<GroupStandingRow, "rank">,
  gf: number,
  ga: number,
): void {
  row.played += 1;
  row.gf += gf;
  row.ga += ga;
  row.gd = row.gf - row.ga;
  if (gf > ga) {
    row.won += 1;
    row.points += 3;
  } else if (gf === ga) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
}

export function sortStandings(rows: Omit<GroupStandingRow, "rank">[]): GroupStandingRow[] {
  return [...rows]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    })
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function buildGroupTables(
  teams: Map<number, WcTeam>,
  fixtures: WcFixtureRow[],
): GroupTable[] {
  const byGroup = new Map<string, Map<number, Omit<GroupStandingRow, "rank">>>();

  for (const team of teams.values()) {
    const g = team.group_letter;
    if (!byGroup.has(g)) byGroup.set(g, new Map());
    byGroup.get(g)!.set(team.id, emptyStanding(team));
  }

  for (const fx of fixtures) {
    if (fx.matchday > 3) continue;
    if (!fx.finished) continue;
    if (fx.home_score == null || fx.away_score == null) continue;

    const home = teams.get(fx.home_team_id);
    const away = teams.get(fx.away_team_id);
    if (!home || !away) continue;

    const homeRow = byGroup.get(home.group_letter)?.get(home.id);
    const awayRow = byGroup.get(away.group_letter)?.get(away.id);
    if (!homeRow || !awayRow) continue;

    applyResult(homeRow, fx.home_score, fx.away_score);
    applyResult(awayRow, fx.away_score, fx.home_score);
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group_letter, teamMap]) => ({
      group_letter,
      rows: sortStandings([...teamMap.values()]),
    }));
}

export function buildTeamResults(
  teamId: number,
  teams: Map<number, WcTeam>,
  fixtures: WcFixtureRow[],
): TeamResultRow[] {
  const out: TeamResultRow[] = [];

  for (const fx of fixtures) {
    if (fx.matchday > 3) continue;
    const isHome = fx.home_team_id === teamId;
    const isAway = fx.away_team_id === teamId;
    if (!isHome && !isAway) continue;

    const oppId = isHome ? fx.away_team_id : fx.home_team_id;
    const opp = teams.get(oppId);
    if (!opp) continue;

    let points: number | null = null;
    let score: string | null = null;

    if (
      fx.finished &&
      fx.home_score != null &&
      fx.away_score != null
    ) {
      const gf = isHome ? fx.home_score : fx.away_score;
      const ga = isHome ? fx.away_score : fx.home_score;
      score = isHome
        ? `${fx.home_score}–${fx.away_score}`
        : `${fx.away_score}–${fx.home_score}`;
      if (gf > ga) points = 3;
      else if (gf === ga) points = 1;
      else points = 0;
    }

    out.push({
      matchday: fx.matchday,
      opponent_code: opp.code,
      opponent_name: opp.short_name,
      home: isHome,
      score,
      points,
    });
  }

  return out.sort((a, b) => a.matchday - b.matchday);
}

export function buildLeaderboards(
  players: Array<{
    id: number;
    name: string;
    position: string;
    goals: number;
    assists: number;
    team_code: string;
    team_name: string;
  }>,
): { scorers: LeaderboardRow[]; assists: LeaderboardRow[] } {
  const base = players.map((p) => ({
    player_id: p.id,
    name: p.name,
    team_code: p.team_code,
    team_name: p.team_name,
    position: p.position,
    goals: p.goals,
    assists: p.assists,
  }));

  const scorers = [...base]
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name))
    .slice(0, 30);

  const assists = [...base]
    .filter((p) => p.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, 30);

  return { scorers, assists };
}

export async function loadWcTablesData(locale = "en"): Promise<{
  groups: GroupTable[];
  scorers: LeaderboardRow[];
  assists: LeaderboardRow[];
  teams: Record<string, TeamDetail>;
}> {
  const [matches, teamsByCode] = await Promise.all([
    loadWcMatchesForDisplay(),
    loadTeamsByCode(),
  ]);

  const groups = buildGroupTablesFromFifaMatches(teamsByCode, matches);
  const { scorers, assists } = buildLeaderboardsFromFifaMatches(
    teamsByCode,
    matches,
  );

  const standingByCode = new Map<string, GroupStandingRow>();
  for (const g of groups) {
    for (const row of g.rows) {
      standingByCode.set(row.code, row);
    }
  }

  const teamsDetail: Record<string, TeamDetail> = {};
  for (const team of teamsByCode.values()) {
    teamsDetail[team.code] = {
      team_id: team.id,
      code: team.code,
      name: team.name,
      short_name: team.short_name,
      group_letter: team.group_letter,
      attack_strength: team.attack_strength,
      defence_strength: team.defence_strength,
      standing: standingByCode.get(team.code) ?? null,
      results: buildTeamResultsFromFifa(team.code, teamsByCode, matches),
    };
  }

  const [localizedScorers, localizedAssists] = await Promise.all([
    localizeLeaderboardRows(scorers, locale),
    localizeLeaderboardRows(assists, locale),
  ]);

  return {
    groups,
    scorers: localizedScorers,
    assists: localizedAssists,
    teams: teamsDetail,
  };
}

export function loadWcTablesDataCached(locale: string): Promise<{
  groups: GroupTable[];
  scorers: LeaderboardRow[];
  assists: LeaderboardRow[];
  teams: Record<string, TeamDetail>;
}> {
  return unstable_cache(
    () => loadWcTablesData(locale),
    ["wc-tables", locale],
    { revalidate: 90 },
  )();
}
