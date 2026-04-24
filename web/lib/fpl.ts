/**
 * Thin client for calls against the public FPL API.
 * Only used for per-user endpoints that are not worth caching in Supabase
 * (e.g. a specific entry's picks).
 */
const FPL_BASE = "https://fantasy.premierleague.com/api";
const UA = "Mozilla/5.0 (compatible; FPL-LLM/0.1)";

export async function fplGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${FPL_BASE}${path}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`FPL ${path} -> ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface FplEntry {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_points: number;
  summary_overall_rank: number;
  current_event: number | null;
  last_deadline_bank: number | null;
  last_deadline_value: number | null;
  last_deadline_total_transfers: number | null;
}

export interface FplPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface FplPicksResponse {
  active_chip: string | null;
  automatic_subs: unknown[];
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
  };
  picks: FplPick[];
}

export interface FplChipPlay {
  name: string;
  time: string;
  event: number;
}

export interface FplHistoryResponse {
  current: Array<{ event: number; points: number; total_points: number }>;
  past: unknown[];
  chips: FplChipPlay[];
}
