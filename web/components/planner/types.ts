export interface PlannerPickPayload {
  slot: number;
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
  is_starter: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
}
