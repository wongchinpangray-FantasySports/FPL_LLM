import type { WcMiniPickStored } from "@/lib/wc-mini/types";
import type { MiniPlayerDisplay } from "@/lib/mini/player-stats";

export const WC_MINI_PLAYER_COLS =
  "id,wc_team_id,name,position,price,form,goals,assists,wc_teams(short_name,code)";

export function rowToWcMiniPlayerDisplay(
  row: Record<string, unknown>,
): MiniPlayerDisplay {
  const teamRaw = row.wc_teams as
    | { short_name: string; code: string }
    | { short_name: string; code: string }[]
    | null;
  const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;

  return {
    fpl_id: row.id as number,
    web_name: row.name as string,
    team: team?.short_name ?? team?.code ?? null,
    team_id: row.wc_team_id as number,
    position: row.position as string,
    base_price: row.price as number | null,
    status: null,
    form: row.form as number | null,
    total_points: null,
    points_per_game: null,
    selected_by_percent: null,
    goals_scored: row.goals as number | null,
    assists: row.assists as number | null,
    expected_goals: null,
    expected_assists: null,
  };
}

export function wcPickToStored(display: MiniPlayerDisplay): WcMiniPickStored {
  return {
    fpl_id: display.fpl_id,
    web_name: display.web_name,
    team: display.team,
    team_id: display.team_id,
    position: display.position,
    price: display.base_price,
    form: display.form,
    goals: display.goals_scored,
    assists: display.assists,
  };
}
