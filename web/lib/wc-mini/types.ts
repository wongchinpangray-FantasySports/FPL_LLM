/** Stored in wc_mini_entries.picks — fpl_id holds wc_players.id for pitch UI reuse. */
export interface WcMiniPickStored {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  price?: number | null;
  form?: number | null;
  goals?: number | null;
  assists?: number | null;
}

export interface WcMiniEntryRow {
  entry_tag: string;
  matchday: number;
  season: string;
  entry_name: string | null;
  picks: WcMiniPickStored[];
  captain_player_id: number;
  vice_player_id: number;
  updated_at: string;
}
