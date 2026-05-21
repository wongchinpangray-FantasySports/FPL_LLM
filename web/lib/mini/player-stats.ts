import type { MiniPickStored } from "./types";

/** Columns loaded from `players_static` for pitch cards. */
export const MINI_PLAYER_DISPLAY_COLS =
  "fpl_id,web_name,name,team,team_id,position,base_price,status,form,total_points,points_per_game,selected_by_percent,goals_scored,assists,expected_goals,expected_assists";

export type MiniPlayerDisplay = MiniPickStored & {
  base_price: number | null;
  status: string | null;
  form: number | null;
  total_points: number | null;
  points_per_game: number | null;
  selected_by_percent: number | null;
  goals_scored: number | null;
  assists: number | null;
  expected_goals: number | null;
  expected_assists: number | null;
};

export function rowToMiniPlayerDisplay(row: Record<string, unknown>): MiniPlayerDisplay {
  return {
    fpl_id: row.fpl_id as number,
    web_name: (row.web_name as string | null) ?? (row.name as string | null),
    team: (row.team as string | null) ?? null,
    team_id: (row.team_id as number | null) ?? null,
    position: (row.position as string | null) ?? null,
    base_price: row.base_price as number | null,
    status: (row.status as string | null) ?? null,
    form: row.form as number | null,
    total_points: row.total_points as number | null,
    points_per_game: row.points_per_game as number | null,
    selected_by_percent: row.selected_by_percent as number | null,
    goals_scored: row.goals_scored as number | null,
    assists: row.assists as number | null,
    expected_goals: row.expected_goals as number | null,
    expected_assists: row.expected_assists as number | null,
  };
}

export function mergePickWithDisplay(
  pick: MiniPickStored,
  row: MiniPlayerDisplay | undefined,
): MiniPlayerDisplay {
  if (!row) {
    return {
      ...pick,
      base_price: null,
      status: null,
      form: null,
      total_points: null,
      points_per_game: null,
      selected_by_percent: null,
      goals_scored: null,
      assists: null,
      expected_goals: null,
      expected_assists: null,
    };
  }
  return { ...row, ...pick, web_name: pick.web_name ?? row.web_name };
}
