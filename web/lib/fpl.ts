/**
 * Thin client for calls against the public FPL API.
 * Only used for per-user endpoints that are not worth caching in Supabase
 * (e.g. a specific entry's picks).
 *
 * FPL sometimes returns **403** to minimal or datacenter-looking clients.
 * We send browser-like headers (including `sec-fetch-*` / `sec-ch-ua` when using
 * the default UA). Override with `FPL_FETCH_USER_AGENT` if needed — when set,
 * we omit `sec-ch-ua*` so they cannot contradict your custom UA.
 */
const FPL_BASE = "https://fantasy.premierleague.com/api";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

/** Must match the Chrome major version embedded in {@link DEFAULT_UA} for `sec-ch-ua`. */
const DEFAULT_CHROME_MAJOR = "136";

function fplHeaders(): Record<string, string> {
  const customUa =
    typeof process !== "undefined" &&
    process.env.FPL_FETCH_USER_AGENT?.trim();
  const ua = customUa || DEFAULT_UA;

  const base: Record<string, string> = {
    "user-agent": ua,
    accept: "application/json, text/plain, */*",
    "accept-language": "en-GB,en;q=0.9",
    referer: "https://fantasy.premierleague.com/",
    origin: "https://fantasy.premierleague.com",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
  };

  if (!customUa) {
    base["sec-ch-ua"] =
      `"Google Chrome";v="${DEFAULT_CHROME_MAJOR}", "Chromium";v="${DEFAULT_CHROME_MAJOR}", "Not A(Brand";v="24"`;
    base["sec-ch-ua-mobile"] = "?0";
    base["sec-ch-ua-platform"] = '"Windows"';
  }

  return base;
}

const FPL_FETCH_TIMEOUT_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryFplStatus(status: number): boolean {
  return status === 403 || status === 408 || status === 429 || status >= 500;
}

export async function fplGet<T = unknown>(
  path: string,
  opts?: { cacheBust?: boolean; timeoutMs?: number; retries?: number },
): Promise<T> {
  let url = `${FPL_BASE}${path}`;
  if (opts?.cacheBust) {
    url += path.includes("?") ? "&" : "?";
    url += `_=${Date.now()}`;
  }
  const timeoutMs = Math.max(3_000, opts?.timeoutMs ?? FPL_FETCH_TIMEOUT_MS);
  const retries = Math.max(0, opts?.retries ?? 2);
  let lastError: Error = new Error(`FPL ${path} failed`);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: fplHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        lastError = new Error(`FPL ${path} -> ${res.status}`);
        if (res.status === 404 || !shouldRetryFplStatus(res.status) || attempt >= retries) {
          throw lastError;
        }
      } else {
        return (await res.json()) as T;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(`FPL ${path} failed`);
      const statusMatch = /-> (\d+)$/.exec(lastError.message);
      const status = statusMatch ? Number(statusMatch[1]) : 0;
      if (
        status === 404 ||
        (status > 0 && !shouldRetryFplStatus(status)) ||
        attempt >= retries
      ) {
        throw lastError;
      }
    }
    await sleep(350 * (attempt + 1));
  }
  throw lastError;
}

/**
 * Session cookie for authenticated routes (`/my-team/`, etc.).
 * Copy from the browser while logged in at fantasy.premierleague.com (Application → Cookies,
 * or the `Cookie` request header on any `/api/` XHR). **Server-only** — treat like a password.
 */
export function fplSessionCookie(): string | undefined {
  const v =
    typeof process !== "undefined"
      ? process.env.FPL_SESSION_COOKIE?.trim()
      : undefined;
  return v || undefined;
}

/** `/my-team/{entry}/` — same 15 as the official Pick Team page when logged in (requires cookie). */
export interface FplMyTeamResponse {
  picks?: FplPick[];
  active_chip?: string | null;
  chips?: unknown[];
  /** Bank / value / FT limits — field names vary slightly by season */
  transfers?: {
    bank?: number;
    value?: number;
    /** free transfers remaining this period (sometimes `limit`) */
    limit?: number;
    num?: number;
    cost?: number;
    event_transfers?: number;
    event_transfers_cost?: number;
  };
}

/**
 * Authenticated GET (Pick Team / my-team). Returns `null` if no cookie, non-OK response, or invalid JSON.
 */
export async function fplGetSession<T = unknown>(
  path: string,
  opts?: { cacheBust?: boolean; cookie?: string },
): Promise<T | null> {
  const cookie = opts?.cookie?.trim() || fplSessionCookie();
  if (!cookie) return null;

  let url = `${FPL_BASE}${path}`;
  if (opts?.cacheBust) {
    url += path.includes("?") ? "&" : "?";
    url += `_=${Date.now()}`;
  }
  try {
    const res = await fetch(url, {
      headers: { ...fplHeaders(), Cookie: cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(FPL_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface FplClassicLeague {
  id: number;
  name: string;
  short_name?: string;
  created?: string;
  closed?: boolean;
  rank?: number | null;
  max_entries?: number | null;
  /** `x` = private mini league, `s` = system (Overall / country / club). */
  league_type?: string;
  scoring?: string;
  admin_entry?: number | null;
  start_event?: number;
  entry_rank?: number | null;
  entry_last_rank?: number | null;
  entry_can_leave?: boolean;
  entry_can_admin?: boolean;
  entry_can_invite?: boolean;
  has_cup?: boolean;
}

export interface FplEntryLeagues {
  classic?: FplClassicLeague[];
  h2h?: FplClassicLeague[];
}

export interface FplEntry {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  /** Null before the first gameweek of a new season. */
  summary_overall_points: number | null;
  summary_overall_rank: number | null;
  current_event: number | null;
  last_deadline_bank: number | null;
  last_deadline_value: number | null;
  last_deadline_total_transfers: number | null;
  leagues?: FplEntryLeagues;
}

/** Safe display for FPL integer stats that may be null pre-season. */
export function formatFplInteger(
  value: number | null | undefined,
  locale?: string,
  fallback = "—",
): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  return value.toLocaleString(locale);
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

/** Per-GW row from `/entry/{id}/history/` `current` array (live game fields). */
export interface FplHistoryCurrentRow {
  event: number;
  points: number;
  total_points: number;
  rank: number;
  rank_sort?: number;
  overall_rank: number;
  percentile_rank: number;
  bank?: number;
  value?: number;
  event_transfers?: number;
  event_transfers_cost?: number;
  points_on_bench?: number;
}

/** Prior seasons summary in `/entry/{id}/history/` `past` array. */
export interface FplHistoryPastSeason {
  season_name: string;
  total_points: number;
  rank: number;
}

export interface FplHistoryResponse {
  current: FplHistoryCurrentRow[];
  past: FplHistoryPastSeason[];
  chips: FplChipPlay[];
}
