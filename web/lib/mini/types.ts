export interface MiniPickStored {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price?: number | null;
  status?: string | null;
  form?: number | null;
  total_points?: number | null;
  points_per_game?: number | null;
  selected_by_percent?: number | null;
  goals_scored?: number | null;
  assists?: number | null;
  expected_goals?: number | null;
  expected_assists?: number | null;
}

export interface MiniEntryRow {
  entry_id: number;
  gw: number;
  season: string;
  entry_name: string | null;
  picks: MiniPickStored[];
  captain_fpl_id: number;
  vice_fpl_id: number;
  updated_at: string;
}
