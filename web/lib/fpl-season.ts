import { getServerSupabase } from "@/lib/supabase";

let cache: { value: string; at: number } | null = null;
const TTL_MS = 60_000;

/**
 * FPL "season" label = calendar year when the game season starts (e.g. `2025`
 * for 2025/26). Written by `data_sync.sync_fpl_players` into `fpl_meta`.
 *
 * Resolution order:
 * 1. `FPL_CURRENT_SEASON` env (e.g. on Workers before meta is synced)
 * 2. `fpl_meta.current_season`
 * 3. Latest `season` present on `fixtures`
 * 4. Fallback `2024`
 */
export async function getCurrentFplSeason(): Promise<string> {
  const env = process.env.FPL_CURRENT_SEASON?.trim();
  if (env) return env;

  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;

  const supa = getServerSupabase();
  const { data: metaRow, error: metaErr } = await supa
    .from("fpl_meta")
    .select("value")
    .eq("key", "current_season")
    .maybeSingle();

  if (!metaErr && metaRow?.value) {
    const v = String(metaRow.value).trim();
    if (v) {
      cache = { value: v, at: now };
      return v;
    }
  }

  const { data: fxRow } = await supa
    .from("fixtures")
    .select("season")
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fromFx =
    fxRow?.season != null ? String(fxRow.season).trim() : "";
  const resolved = fromFx || "2024";
  cache = { value: resolved, at: now };
  return resolved;
}

/** For tests or after a manual DB season change. */
export function clearFplSeasonCache(): void {
  cache = null;
}
