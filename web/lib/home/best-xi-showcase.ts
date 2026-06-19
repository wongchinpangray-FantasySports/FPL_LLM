import type { PlannerPickPayload } from "@/components/planner/types";
import { findBestStartingElevenFromPool } from "@/lib/planner/optimize-xi";
import { computeTopXpByPositionForShowcase } from "@/lib/planner/top-xp-by-position";
import { getServerSupabase } from "@/lib/supabase";

export type HomeBestXi = {
  gw: number;
  score: number;
  cost: number;
  picks: PlannerPickPayload[];
  captainId: number;
};

function assignXiSlots(
  xi: Array<{
    fpl_id: number;
    web_name: string | null;
    team: string | null;
    team_id: number | null;
    position: string | null;
    base_price: number | null;
  }>,
  captainId: number,
): PlannerPickPayload[] {
  const order = ["GKP", "DEF", "MID", "FWD"] as const;
  const grouped: Record<string, typeof xi> = {
    GKP: [],
    DEF: [],
    MID: [],
    FWD: [],
  };
  for (const p of xi) {
    const pos = p.position ?? "MID";
    if (grouped[pos]) grouped[pos].push(p);
  }
  let slot = 1;
  const picks: PlannerPickPayload[] = [];
  for (const pos of order) {
    for (const p of grouped[pos]) {
      picks.push({
        slot: slot++,
        fpl_id: p.fpl_id,
        web_name: p.web_name,
        team: p.team,
        team_id: p.team_id,
        position: p.position,
        base_price: p.base_price,
        is_starter: true,
        is_captain: p.fpl_id === captainId,
        is_vice_captain: false,
      });
    }
  }
  return picks;
}

export async function computeHomeBestXiShowcase(): Promise<HomeBestXi | null> {
  const tops = await computeTopXpByPositionForShowcase(1, undefined, 6);
  const poolRows = [
    ...tops.tops.GKP,
    ...tops.tops.DEF,
    ...tops.tops.MID,
    ...tops.tops.FWD,
  ];
  if (poolRows.length < 11) return null;

  const ids = [...new Set(poolRows.map((p) => p.fpl_id))];
  const supa = getServerSupabase();
  const { data: staticRows } = await supa
    .from("players_static")
    .select("fpl_id,web_name,team,team_id,position,base_price")
    .in("fpl_id", ids);

  const staticById = new Map(
    (staticRows ?? []).map((r) => [r.fpl_id as number, r]),
  );

  const xpByFid: Record<string, number> = {};
  for (const p of poolRows) {
    xpByFid[String(p.fpl_id)] = p.xp_next_gw;
  }

  let slot = 0;
  const pool: PlannerPickPayload[] = ids.map((fpl_id) => {
    const row = staticById.get(fpl_id);
    const top = poolRows.find((p) => p.fpl_id === fpl_id);
    return {
      slot: slot++,
      fpl_id,
      web_name: row?.web_name ?? top?.web_name ?? null,
      team: row?.team ?? top?.team ?? null,
      team_id: (row?.team_id as number | null) ?? null,
      position: row?.position ?? top?.position ?? "MID",
      base_price: row?.base_price != null ? Number(row.base_price) : null,
      is_starter: false,
      is_captain: false,
      is_vice_captain: false,
    };
  });

  const best = findBestStartingElevenFromPool(pool, xpByFid);
  if (!best) return null;

  const enriched = best.xi.map((p) => {
    const row = staticById.get(p.fpl_id);
    return {
      fpl_id: p.fpl_id,
      web_name: row?.web_name ?? p.web_name,
      team: row?.team ?? p.team,
      team_id: (row?.team_id as number | null) ?? p.team_id,
      position: row?.position ?? p.position,
      base_price: row?.base_price != null ? Number(row.base_price) : p.base_price,
    };
  });

  const captainId = best.xi.reduce(
    (bestId, p) =>
      (xpByFid[String(p.fpl_id)] ?? 0) > (xpByFid[String(bestId)] ?? 0)
        ? p.fpl_id
        : bestId,
    best.xi[0].fpl_id,
  );

  const cost = enriched.reduce((s, p) => s + (p.base_price ?? 0), 0);

  return {
    gw: tops.fromGw,
    score: Math.round(best.score * 10) / 10,
    cost: Math.round(cost * 10) / 10,
    picks: assignXiSlots(enriched, captainId),
    captainId,
  };
}
