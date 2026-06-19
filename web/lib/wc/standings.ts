import { getServerSupabase } from "@/lib/supabase";
import { isWcMatchFinished } from "@/lib/wc/fifa-rounds";
import {
  applyMatchStatsToFixtures,
  type WcFixtureRow,
} from "@/lib/wc/projection-context";
import type { WcTeam } from "@/lib/wc/types";

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
  players: Array<{
    id: number;
    name: string;
    position: string;
    goals: number;
    assists: number;
    minutes: number;
  }>;
};

function emptyStanding(team: WcTeam): Omit<GroupStandingRow, "rank"> {
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

function applyResult(
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

function sortStandings(rows: Omit<GroupStandingRow, "rank">[]): GroupStandingRow[] {
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

export async function loadWcTablesData(): Promise<{
  groups: GroupTable[];
  scorers: LeaderboardRow[];
  assists: LeaderboardRow[];
  teams: Record<string, TeamDetail>;
}> {
  const supa = getServerSupabase();

  const [{ data: teamRows }, { data: fixtureRows }, { data: statsRows }, { data: playerRows }] =
    await Promise.all([
      supa
        .from("wc_teams")
        .select("id,code,name,short_name,group_letter,attack_strength,defence_strength")
        .order("group_letter")
        .order("short_name"),
      supa
        .from("wc_fixtures")
        .select("id,matchday,home_team_id,away_team_id,finished,home_score,away_score")
        .lte("matchday", 3),
      supa
        .from("wc_match_stats")
        .select("home_code,away_code,round_id,status,home_score,away_score")
        .lte("round_id", 3),
      supa
        .from("wc_players")
        .select("id,name,position,goals,assists,minutes,wc_team_id,wc_teams(code,name,short_name)")
        .order("goals", { ascending: false }),
    ]);

  const teams = new Map<number, WcTeam>();
  for (const r of teamRows ?? []) {
    teams.set(r.id as number, r as WcTeam);
  }

  const codeToId = new Map<string, number>();
  for (const [id, t] of teams) codeToId.set(t.code, id);

  let fixtures = (fixtureRows ?? []) as WcFixtureRow[];
  fixtures = applyMatchStatsToFixtures(fixtures, codeToId, statsRows ?? []);

  for (const fx of fixtures) {
    if (
      fx.home_score != null &&
      fx.away_score != null &&
      isWcMatchFinished({
        status: "finished",
        home_score: fx.home_score,
      })
    ) {
      fx.finished = true;
    }
  }

  const groups = buildGroupTables(teams, fixtures);

  const standingByTeamId = new Map<number, GroupStandingRow>();
  for (const g of groups) {
    for (const row of g.rows) {
      standingByTeamId.set(row.team_id, row);
    }
  }

  const playersForBoard = (playerRows ?? []).map((r) => {
    const teamRaw = r.wc_teams as
      | { code: string; name: string; short_name: string }
      | { code: string; name: string; short_name: string }[]
      | null;
    const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;
    return {
      id: r.id as number,
      name: r.name as string,
      position: r.position as string,
      goals: Number(r.goals ?? 0),
      assists: Number(r.assists ?? 0),
      minutes: Number(r.minutes ?? 0),
      team_code: team?.code ?? "???",
      team_name: team?.short_name ?? team?.name ?? "???",
    };
  });

  const { scorers, assists } = buildLeaderboards(playersForBoard);

  const playersByTeam = new Map<number, TeamDetail["players"]>();
  for (const p of playersForBoard) {
    const team = [...teams.values()].find((t) => t.code === p.team_code);
    if (!team) continue;
    const list = playersByTeam.get(team.id) ?? [];
    list.push({
      id: p.id,
      name: p.name,
      position: p.position,
      goals: p.goals,
      assists: p.assists,
      minutes: p.minutes,
    });
    playersByTeam.set(team.id, list);
  }

  const teamsDetail: Record<string, TeamDetail> = {};
  for (const team of teams.values()) {
    teamsDetail[team.code] = {
      team_id: team.id,
      code: team.code,
      name: team.name,
      short_name: team.short_name,
      group_letter: team.group_letter,
      attack_strength: team.attack_strength,
      defence_strength: team.defence_strength,
      standing: standingByTeamId.get(team.id) ?? null,
      results: buildTeamResults(team.id, teams, fixtures),
      players: (playersByTeam.get(team.id) ?? []).sort(
        (a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name),
      ),
    };
  }

  return { groups, scorers, assists, teams: teamsDetail };
}
