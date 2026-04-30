/**
 * Thin client for calls against the public FPL API.
 * Only used for per-user endpoints that are not worth caching in Supabase
 * (e.g. a specific entry's picks).
 *
 * FPL sometimes returns **403** to minimal or datacenter-looking clients.
 * We send browser-like headers; override with `FPL_FETCH_USER_AGENT` if needed.
 */
const FPL_BASE = "https://fantasy.premierleague.com/api";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function fplHeaders(): Record<string, string> {
  const ua =
    (typeof process !== "undefined" &&
      process.env.FPL_FETCH_USER_AGENT?.trim()) ||
    DEFAULT_UA;
  return {
    "user-agent": ua,
    accept: "application/json, text/plain, */*",
    "accept-language": "en-GB,en;q=0.9",
    referer: "https://fantasy.premierleague.com/",
    origin: "https://fantasy.premierleague.com",
  };
}

export async function fplGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${FPL_BASE}${path}`, {
    headers: fplHeaders(),
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
  /** Lineup slot 1–15 */
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  /** 1 GKP, 2 DEF, 3 MID, 4 FWD — present on live API picks */
  element_type?: number;
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
