import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase";
import { WC_GROUP_TEAMS } from "@/lib/wc/seed-data";
import {
  FIFA_POOL_OK,
  isFifaFantasyConfigured,
  syncWcPlayersFromFifa,
  WC_MIN_PLAYER_POOL,
} from "@/lib/wc/fifa-sync";
import {
  purgeInvalidFplWcPlayers,
  replaceExpandedWcPlayers,
} from "@/lib/wc/fpl-wc-pool";

let poolLock: Promise<WcPoolStatus> | null = null;
let lastFifaSyncAt = 0;
const FIFA_COOLDOWN_MS = 10 * 60 * 1000;

async function countBySource(
  supa: SupabaseClient,
  source: string,
): Promise<number> {
  const { count, error } = await supa
    .from("wc_players")
    .select("id", { count: "exact", head: true })
    .eq("source", source);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function totalPlayers(supa: SupabaseClient): Promise<number> {
  const { count, error } = await supa
    .from("wc_players")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type WcPoolStatus = {
  source: "fifa" | "fpl" | "empty";
  total: number;
  fifa_count: number;
  fpl_count: number;
  fifa_configured: boolean;
  fifa_last_reason?: string;
};

/**
 * FIFA fantasy bootstrap first (when env is set), then expanded FPL seeds as fallback.
 */
export async function refreshWcPlayerPool(
  supa: SupabaseClient,
  teamByCode: Map<string, number>,
  validCodes: Set<string>,
  options?: { force?: boolean },
): Promise<WcPoolStatus> {
  const force = options?.force ?? false;
  let fifaReason: string | undefined;
  const fifaConfigured = isFifaFantasyConfigured();

  let fifaCount = await countBySource(supa, "fifa");
  let fplCount = await countBySource(supa, "fpl");

  const shouldTryFifa =
    fifaConfigured &&
    (force ||
      fifaCount < FIFA_POOL_OK ||
      fplCount > 0 ||
      (await totalPlayers(supa)) < WC_MIN_PLAYER_POOL);

  if (shouldTryFifa) {
    const cooledOff =
      !force && Date.now() - lastFifaSyncAt < FIFA_COOLDOWN_MS;
    if (!cooledOff) {
      lastFifaSyncAt = Date.now();
      const fifa = await syncWcPlayersFromFifa();
      fifaReason = fifa.reason;
      if (fifa.debug && fifa.reason) {
        const tries = fifa.debug.urls_tried
          .map((u) => `${u.status}@${u.url} (${u.parsed_players} players)`)
          .join("; ");
        fifaReason = `${fifa.reason} [${tries}]`;
      }
      fifaCount = await countBySource(supa, "fifa");
      fplCount = await countBySource(supa, "fpl");
    }
  }

  const purged = await purgeInvalidFplWcPlayers(supa);
  if (purged > 0) fplCount = await countBySource(supa, "fpl");

  const total = await totalPlayers(supa);
  const needsCuratedFallback =
    fifaCount < FIFA_POOL_OK &&
    (total < WC_MIN_PLAYER_POOL || fplCount > 45 || purged > 0);

  if (needsCuratedFallback) {
    await replaceExpandedWcPlayers(supa, teamByCode, validCodes);
    fplCount = await countBySource(supa, "fpl");
  }

  const finalTotal = await totalPlayers(supa);
  const finalFifa = await countBySource(supa, "fifa");
  const finalFpl = await countBySource(supa, "fpl");

  const source: WcPoolStatus["source"] =
    finalFifa >= FIFA_POOL_OK
      ? "fifa"
      : finalFpl > 0 || finalTotal > 0
        ? "fpl"
        : "empty";

  return {
    source,
    total: finalTotal,
    fifa_count: finalFifa,
    fpl_count: finalFpl,
    fifa_configured: fifaConfigured,
    fifa_last_reason: fifaReason,
  };
}

/** Serialized player-pool refresh (safe under concurrent API calls). */
export function ensureWcPlayerPool(options?: {
  force?: boolean;
}): Promise<WcPoolStatus> {
  if (!poolLock) {
    poolLock = (async () => {
      const supa = getServerSupabase();
      const { data: teams } = await supa.from("wc_teams").select("id,code");
      const teamByCode = new Map(
        (teams ?? []).map((r) => [r.code as string, r.id as number]),
      );
      const validCodes = new Set(WC_GROUP_TEAMS.map((t) => t.code));
      return refreshWcPlayerPool(supa, teamByCode, validCodes, options);
    })().finally(() => {
      poolLock = null;
    });
  }
  return poolLock;
}
