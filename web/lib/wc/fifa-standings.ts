import {
  buildWcMatchSchedule,
  isWcMatchFinished,
  type WcMatchGoal,
  type WcMatchRow,
} from "@/lib/wc/fifa-rounds";
import { fifaTeamToWcCode } from "@/lib/wc/fifa-teams";
import type { WcTeam } from "@/lib/wc/types";
import type { GroupTable, LeaderboardRow } from "@/lib/wc/standings";
import {
  applyResult,
  emptyStanding,
  sortStandings,
  type GroupStandingRow,
} from "@/lib/wc/standings";

function resolveTeamCode(
  code: string,
  name: string,
  teamsByCode: Map<string, WcTeam>,
): string | null {
  if (teamsByCode.has(code)) return code;
  const mapped = fifaTeamToWcCode({ name, short_name: code });
  if (mapped && teamsByCode.has(mapped)) return mapped;
  return null;
}

export function buildGroupTablesFromFifaMatches(
  teamsByCode: Map<string, WcTeam>,
  matches: WcMatchRow[],
): GroupTable[] {
  const byGroup = new Map<string, Map<string, Omit<GroupStandingRow, "rank">>>();

  for (const team of teamsByCode.values()) {
    const g = team.group_letter;
    if (!byGroup.has(g)) byGroup.set(g, new Map());
    byGroup.get(g)!.set(team.code, emptyStanding(team));
  }

  for (const m of matches) {
    if (m.round_id > 3) continue;
    if (!isWcMatchFinished(m)) continue;
    if (m.home_score == null || m.away_score == null) continue;

    const homeCode = resolveTeamCode(m.home_code, m.home_name, teamsByCode);
    const awayCode = resolveTeamCode(m.away_code, m.away_name, teamsByCode);
    if (!homeCode || !awayCode) continue;

    const home = teamsByCode.get(homeCode)!;
    const away = teamsByCode.get(awayCode)!;
    if (home.group_letter !== away.group_letter) continue;

    const homeRow = byGroup.get(home.group_letter)?.get(homeCode);
    const awayRow = byGroup.get(away.group_letter)?.get(awayCode);
    if (!homeRow || !awayRow) continue;

    applyResult(homeRow, m.home_score, m.away_score);
    applyResult(awayRow, m.away_score, m.home_score);
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group_letter, teamMap]) => ({
      group_letter,
      rows: sortStandings([...teamMap.values()]),
    }));
}

type GoalAssists = { goals: number; assists: number };

function normPlayerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function bumpStat(
  map: Map<number, GoalAssists>,
  id: number,
  field: "goals" | "assists",
): void {
  const row = map.get(id) ?? { goals: 0, assists: 0 };
  row[field] += 1;
  map.set(id, row);
}

function bumpStatByName(
  map: Map<string, GoalAssists>,
  name: string,
  teamCode: string,
  field: "goals" | "assists",
): void {
  const key = `${normPlayerName(name)}:${teamCode}`;
  const row = map.get(key) ?? { goals: 0, assists: 0 };
  row[field] += 1;
  map.set(key, row);
}

/** Tournament G/A per player from finished match goal events (FIFA feed). */
export function buildPlayerGoalAssistsFromFifaMatches(
  teamsByCode: Map<string, WcTeam>,
  matches: WcMatchRow[],
): {
  byFifaId: Map<number, GoalAssists>;
  byNameTeam: Map<string, GoalAssists>;
} {
  const byFifaId = new Map<number, GoalAssists>();
  const byNameTeam = new Map<string, GoalAssists>();

  for (const m of matches) {
    if (!isWcMatchFinished(m)) continue;

    const homeCode =
      resolveTeamCode(m.home_code, m.home_name, teamsByCode) ?? m.home_code;
    const awayCode =
      resolveTeamCode(m.away_code, m.away_name, teamsByCode) ?? m.away_code;

    const record = (g: WcMatchGoal, teamCode: string) => {
      const scorer = g.scorer_display || g.scorer;
      if (!scorer.trim()) return;
      if (g.fifa_player_id != null) bumpStat(byFifaId, g.fifa_player_id, "goals");
      bumpStatByName(byNameTeam, scorer, teamCode, "goals");

      const assist = g.assist_display || g.assist;
      if (!assist?.trim()) return;
      if (g.fifa_assist_id != null) bumpStat(byFifaId, g.fifa_assist_id, "assists");
      bumpStatByName(byNameTeam, assist, teamCode, "assists");
    };

    for (const g of m.home_goals) record(g, homeCode);
    for (const g of m.away_goals) record(g, awayCode);
  }

  return { byFifaId, byNameTeam };
}

export function lookupPlayerGoalAssists(
  stats: ReturnType<typeof buildPlayerGoalAssistsFromFifaMatches>,
  player: {
    fifa_element_id?: number | null;
    name: string;
    team_code: string;
  },
): GoalAssists {
  if (player.fifa_element_id != null) {
    const byId = stats.byFifaId.get(player.fifa_element_id);
    if (byId) return byId;
  }
  return (
    stats.byNameTeam.get(
      `${normPlayerName(player.name)}:${player.team_code}`,
    ) ?? { goals: 0, assists: 0 }
  );
}

type GoalAgg = {
  player_id: number;
  name: string;
  team_code: string;
  team_name: string;
  position: string;
  goals: number;
  assists: number;
};

function playerKey(g: WcMatchGoal, teamCode: string): string {
  if (g.fifa_player_id != null) return `id:${g.fifa_player_id}`;
  return `${g.scorer_display || g.scorer}:${teamCode}`;
}

function addGoalEvent(
  map: Map<string, GoalAgg>,
  g: WcMatchGoal,
  teamCode: string,
  teamName: string,
) {
  const name = g.scorer_display || g.scorer;
  if (!name.trim()) return;

  const key = playerKey(g, teamCode);
  const row = map.get(key) ?? {
    player_id: g.fifa_player_id ?? key.length * 997,
    name,
    team_code: teamCode,
    team_name: teamName,
    position: "—",
    goals: 0,
    assists: 0,
  };
  row.goals += 1;
  map.set(key, row);

  if (g.assist || g.assist_display) {
    const assistName = g.assist_display || g.assist!;
    const assistKey = g.fifa_assist_id
      ? `id:${g.fifa_assist_id}`
      : `${assistName}:${teamCode}`;
    const assistRow = map.get(assistKey) ?? {
      player_id: g.fifa_assist_id ?? assistKey.length * 991,
      name: assistName,
      team_code: teamCode,
      team_name: teamName,
      position: "—",
      goals: 0,
      assists: 0,
    };
    assistRow.assists += 1;
    map.set(assistKey, assistRow);
  }
}

export function buildLeaderboardsFromFifaMatches(
  teamsByCode: Map<string, WcTeam>,
  matches: WcMatchRow[],
): { scorers: LeaderboardRow[]; assists: LeaderboardRow[] } {
  const map = new Map<string, GoalAgg>();

  for (const m of matches) {
    if (!isWcMatchFinished(m)) continue;

    const homeCode =
      resolveTeamCode(m.home_code, m.home_name, teamsByCode) ?? m.home_code;
    const awayCode =
      resolveTeamCode(m.away_code, m.away_name, teamsByCode) ?? m.away_code;
    const homeName = teamsByCode.get(homeCode)?.short_name ?? m.home_name;
    const awayName = teamsByCode.get(awayCode)?.short_name ?? m.away_name;

    for (const g of m.home_goals) addGoalEvent(map, g, homeCode, homeName);
    for (const g of m.away_goals) addGoalEvent(map, g, awayCode, awayName);
  }

  const base = [...map.values()].map((p) => ({
    player_id: p.player_id,
    name: p.name,
    team_code: p.team_code,
    team_name: p.team_name,
    position: p.position,
    goals: p.goals,
    assists: p.assists,
  }));

  const scorers = [...base]
    .filter((p) => p.goals > 0)
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        b.assists - a.assists ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 30);

  const assists = [...base]
    .filter((p) => p.assists > 0)
    .sort(
      (a, b) =>
        b.assists - a.assists ||
        b.goals - a.goals ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 30);

  return { scorers, assists };
}

export function buildTeamResultsFromFifa(
  teamCode: string,
  teamsByCode: Map<string, WcTeam>,
  matches: WcMatchRow[],
): import("@/lib/wc/standings").TeamResultRow[] {
  const out: import("@/lib/wc/standings").TeamResultRow[] = [];

  for (const m of matches) {
    if (m.round_id > 3) continue;

    const homeCode =
      resolveTeamCode(m.home_code, m.home_name, teamsByCode) ?? m.home_code;
    const awayCode =
      resolveTeamCode(m.away_code, m.away_name, teamsByCode) ?? m.away_code;

    const isHome = homeCode === teamCode;
    const isAway = awayCode === teamCode;
    if (!isHome && !isAway) continue;

    const oppCode = isHome ? awayCode : homeCode;
    const opp = teamsByCode.get(oppCode);

    let points: number | null = null;
    let score: string | null = null;

    if (
      isWcMatchFinished(m) &&
      m.home_score != null &&
      m.away_score != null
    ) {
      const gf = isHome ? m.home_score : m.away_score;
      const ga = isHome ? m.away_score : m.home_score;
      score = isHome
        ? `${m.home_score}–${m.away_score}`
        : `${m.away_score}–${m.home_score}`;
      if (gf > ga) points = 3;
      else if (gf === ga) points = 1;
      else points = 0;
    }

    out.push({
      matchday: m.round_id,
      opponent_code: oppCode,
      opponent_name: opp?.short_name ?? (isHome ? m.away_name : m.home_name),
      home: isHome,
      score,
      points,
    });
  }

  return out.sort((a, b) => a.matchday - b.matchday);
}

export async function loadFifaWcMatches(): Promise<WcMatchRow[]> {
  const { matches } = await buildWcMatchSchedule();
  return matches;
}

export async function loadTeamsByCode(): Promise<Map<string, WcTeam>> {
  const { getServerSupabase } = await import("@/lib/supabase");
  const supa = getServerSupabase();
  const { data } = await supa
    .from("wc_teams")
    .select(
      "id,code,name,short_name,group_letter,attack_strength,defence_strength",
    );
  const map = new Map<string, WcTeam>();
  for (const r of data ?? []) {
    map.set(r.code as string, r as WcTeam);
  }
  return map;
}
