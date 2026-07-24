import { fplGet } from "@/lib/fpl";
import { getServerSupabase } from "@/lib/supabase";

let cache: { value: string; at: number } | null = null;
const TTL_MS = 60_000;

/**
 * FPL "season" label = calendar year when the game season starts (e.g. `2025`
 * for 2025/26). Written by `data_sync.sync_fpl_players` into `fpl_meta`.
 *
 * Resolution order:
 * 1. `FPL_CURRENT_SEASON` env (e.g. on Workers before meta is synced)
 * 2. Live `bootstrap-static` when newer than stale DB meta
 * 3. `fpl_meta.current_season`
 * 4. Off-season heuristic from finished gameweeks
 * 5. Latest `season` present on `fixtures`
 * 6. Fallback `2026`
 */
export async function getCurrentFplSeason(): Promise<string> {
  const env = process.env.FPL_CURRENT_SEASON?.trim();
  if (env) return env;

  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;

  const supa = getServerSupabase();
  const liveSeason = await seasonStartYearFromBootstrap();
  const { data: metaRow, error: metaErr } = await supa
    .from("fpl_meta")
    .select("value")
    .eq("key", "current_season")
    .maybeSingle();

  const metaSeason =
    !metaErr && metaRow?.value ? String(metaRow.value).trim() : "";

  if (liveSeason && metaSeason && Number(liveSeason) > Number(metaSeason)) {
    cache = { value: liveSeason, at: now };
    return liveSeason;
  }

  if (metaSeason) {
    cache = { value: metaSeason, at: now };
    return metaSeason;
  }

  if (liveSeason) {
    cache = { value: liveSeason, at: now };
    return liveSeason;
  }

  const { data: fxRow } = await supa
    .from("fixtures")
    .select("season")
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: gwRows } = await supa
    .from("gameweeks")
    .select("id,finished,deadline_time")
    .order("id", { ascending: true });

  const gws = gwRows ?? [];
  if (
    gws.length > 0 &&
    gws.every((g) => g.finished) &&
    gws[gws.length - 1]?.deadline_time
  ) {
    const offSeasonYear = String(gws[gws.length - 1].deadline_time).slice(0, 4);
    if (isFplSeasonKey(offSeasonYear)) {
      cache = { value: offSeasonYear, at: now };
      return offSeasonYear;
    }
  }

  const fromFx =
    fxRow?.season != null ? String(fxRow.season).trim() : "";
  const resolved = fromFx || "2026";
  cache = { value: resolved, at: now };
  return resolved;
}

/** Calendar start year from live FPL bootstrap (e.g. 2026 for GW1 in Aug 2026). */
export async function seasonStartYearFromBootstrap(): Promise<string | null> {
  try {
    const raw = await fplGet<{
      events?: Array<{ id: number; finished?: boolean; deadline_time?: string }>;
    }>("/bootstrap-static/");
    const events = raw.events ?? [];
    if (!events.length) return null;
    const allFinished = events.every((e) => e.finished);
    const pick = allFinished
      ? events.reduce((a, b) => (a.id > b.id ? a : b))
      : events.reduce((a, b) => (a.id < b.id ? a : b));
    const dt = pick?.deadline_time;
    if (typeof dt === "string" && dt.length >= 4 && /^\d{4}/.test(dt)) {
      return dt.slice(0, 4);
    }
  } catch {
    return null;
  }
  return null;
}

/** For tests or after a manual DB season change. */
export function clearFplSeasonCache(): void {
  cache = null;
}

const FPL_SEASON_YEAR_RE = /^\d{4}$/;

/** True if `s` is a plausible FPL season key (e.g. `2025` for 2025/26). */
export function isFplSeasonKey(s: string): boolean {
  return FPL_SEASON_YEAR_RE.test(s.trim());
}

/**
 * If the model passed an explicit `fpl_season`, use it for **historical** reads
 * (GW stats / past fixtures). Otherwise use the active campaign from meta/env.
 */
export async function resolveFplSeasonForTool(
  fplSeasonInput: unknown,
): Promise<string> {
  if (typeof fplSeasonInput === "string") {
    const t = fplSeasonInput.trim();
    if (isFplSeasonKey(t)) return t;
  }
  return getCurrentFplSeason();
}
