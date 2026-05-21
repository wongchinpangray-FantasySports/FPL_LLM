export interface MiniPickStored {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
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
