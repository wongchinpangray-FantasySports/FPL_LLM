import type { PlannerPickPayload } from "@/components/planner/types";
import type { PlannerGwStripCell } from "@/components/planner/pitch-view";
import { findBestXiByXp } from "@/lib/planner/optimize-xi";
import { validatePlannerSquad } from "@/lib/planner/validate";
import { getServerSupabase } from "@/lib/supabase";
import type { FixtureProjection } from "@/lib/xp";
import { projectPlayers, resolveCurrentGw } from "@/lib/xp";
import { unstable_cache } from "next/cache";

type Pos = "GKP" | "DEF" | "MID" | "FWD";

const POS_ORDER: Pos[] = ["GKP", "DEF", "MID", "FWD"];
const NEED_FULL: Record<Pos, number> = {
  GKP: 2,
  DEF: 5,
  MID: 5,
  FWD: 3,
};

export type ShowcaseRecommendedSquad = {
  targetGw: number;
  currentGw: number;
  picks: PlannerPickPayload[];
  captainId: number | null;
  viceId: number | null;
  /** Sum of next-GW xP for best XI with captain doubled */
  xiXpNext: number;
  squadCost: number;
  gwForecastByFplId: Record<number, PlannerGwStripCell[]>;
  nextGwXpByFplId: Record<number, number>;
};

type Cand = {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  team_id: number | null;
  position: Pos;
  price: number;
  xp_next: number;
  by_gw: PlannerGwStripCell[];
};

function buildByGwStrip(
  fixtures: FixtureProjection[],
  fromGw: number,
  toGw: number,
): PlannerGwStripCell[] {
  const map = new Map<number, { parts: string[]; xp: number }>();
  for (const f of fixtures) {
    if (f.gw < fromGw || f.gw > toGw) continue;
    const tag = `${f.opp_short}${f.home ? "H" : "A"}`;
    const cur = map.get(f.gw);
    if (!cur) {
      map.set(f.gw, { parts: [tag], xp: f.xp_total });
    } else {
      cur.parts.push(tag);
      cur.xp += f.xp_total;
    }
  }
  return Array.from(map.keys())
    .sort((a, b) => a - b)
    .map((gw) => {
      const { parts, xp } = map.get(gw)!;
      return {
        gw,
        opp: parts.join("·"),
        xp: Math.round(xp * 100) / 100,
      };
    });
}

function nextGwXp(
  fixtures: FixtureProjection[],
  fromGw: number,
): number {
  const v = fixtures
    .filter((f) => f.gw === fromGw)
    .reduce((s, f) => s + f.xp_total, 0);
  return Math.round(v * 100) / 100;
}

function totalNeed(need: Record<Pos, number>): number {
  return POS_ORDER.reduce((acc, p) => acc + need[p], 0);
}

function orderStarters(squad: Cand[], xi: Set<number>): Cand[] {
  const st = squad.filter((c) => xi.has(c.fpl_id));
  const line = (pos: Pos) =>
    st
      .filter((c) => c.position === pos)
      .sort((a, b) => b.xp_next - a.xp_next || a.price - b.price);
  return [...line("GKP"), ...line("DEF"), ...line("MID"), ...line("FWD")];
}

function orderBench(squad: Cand[], xi: Set<number>): Cand[] {
  const b = squad.filter((c) => !xi.has(c.fpl_id));
  const gk = b.filter((c) => c.position === "GKP");
  const of = b
    .filter((c) => c.position !== "GKP")
    .sort((a, b) => b.xp_next - a.xp_next || a.price - b.price);
  return [...gk, ...of];
}

/** Best addable player for a line still needing picks (lists are xp-sorted). */
function bestAddableForPosition(
  pos: Pos,
  need: Record<Pos, number>,
  squad: Cand[],
  teamCount: Map<number, number>,
  byPos: Record<Pos, Cand[]>,
): Cand | null {
  if (need[pos] <= 0) return null;
  for (const cand of byPos[pos]) {
    if (squad.some((s) => s.fpl_id === cand.fpl_id)) continue;
    const tid = cand.team_id ?? -1;
    if (tid >= 0 && (teamCount.get(tid) ?? 0) >= 3) continue;
    return cand;
  }
  return null;
}

async function computeShowcaseRecommendedSquadUncached(): Promise<ShowcaseRecommendedSquad | null> {
  const { current } = await resolveCurrentGw();
  const fromGw = current + 1;
  if (fromGw > 38) return null;

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("players_static")
    .select("fpl_id, team_id, position, base_price")
    .not("team_id", "is", null)
    .in("position", [...POS_ORDER]);

  if (error || !data?.length) return null;

  const ids = data
    .map((r) => r.fpl_id as number)
    .filter((n) => Number.isFinite(n) && n > 0);

  const proj = await projectPlayers(ids, {
    currentGw: current,
    fromGw,
    toGw: fromGw,
  });

  const byPos: Record<Pos, Cand[]> = {
    GKP: [],
    DEF: [],
    MID: [],
    FWD: [],
  };

  for (const [, p] of proj) {
    const pos = (p.position ?? "") as Pos;
    if (!byPos[pos]) continue;
    const price = p.price;
    if (price == null || !Number.isFinite(price) || price <= 0) continue;
    const xpN = nextGwXp(p.fixtures, fromGw);
    if (xpN <= 0) continue;
    if (p.availability < 0.2) continue;
    byPos[pos].push({
      fpl_id: p.fpl_id,
      web_name: p.web_name,
      team: p.team,
      team_id: p.team_id,
      position: pos,
      price,
      xp_next: xpN,
      by_gw: buildByGwStrip(p.fixtures, fromGw, fromGw),
    });
  }

  for (const pos of POS_ORDER) {
    byPos[pos].sort(
      (a, b) => b.xp_next - a.xp_next || a.price - b.price,
    );
  }

  const need = { ...NEED_FULL };
  const squad: Cand[] = [];
  const teamCount = new Map<number, number>();

  while (totalNeed(need) > 0) {
    let best: Cand | null = null;
    let bestPos: Pos | null = null;
    for (const pos of POS_ORDER) {
      const cand = bestAddableForPosition(
        pos,
        need,
        squad,
        teamCount,
        byPos,
      );
      if (!cand) continue;
      if (
        best == null ||
        cand.xp_next > best.xp_next ||
        (cand.xp_next === best.xp_next && cand.price < best.price)
      ) {
        best = cand;
        bestPos = pos;
      }
    }
    if (best == null || bestPos == null) return null;
    const tid = best.team_id ?? -1;
    squad.push(best);
    need[bestPos] -= 1;
    if (tid >= 0) {
      teamCount.set(tid, (teamCount.get(tid) ?? 0) + 1);
    }
  }

  if (squad.length !== 15) return null;

  const picksBare: PlannerPickPayload[] = squad.map((c, i) => ({
    slot: i + 1,
    fpl_id: c.fpl_id,
    web_name: c.web_name,
    team: c.team,
    team_id: c.team_id,
    position: c.position,
    base_price: c.price,
    is_starter: false,
    is_captain: false,
    is_vice_captain: false,
  }));

  const xpByFid: Record<string, number> = {};
  for (const c of squad) xpByFid[String(c.fpl_id)] = c.xp_next;

  const xi = findBestXiByXp(picksBare, xpByFid);
  if (!xi || xi.length !== 11) return null;

  const xiSet = new Set(xi);
  let captainId: number | null = null;
  let best = -1;
  for (const id of xi) {
    const x = xpByFid[String(id)] ?? 0;
    if (x > best) {
      best = x;
      captainId = id;
    }
  }
  let viceId: number | null = null;
  let second = -1;
  for (const id of xi) {
    if (id === captainId) continue;
    const x = xpByFid[String(id)] ?? 0;
    if (x > second) {
      second = x;
      viceId = id;
    }
  }

  const startersOrdered = orderStarters(squad, xiSet);
  const benchOrdered = orderBench(squad, xiSet);
  const ordered = [...startersOrdered, ...benchOrdered];

  const picks: PlannerPickPayload[] = ordered.map((c, i) => ({
    slot: i + 1,
    fpl_id: c.fpl_id,
    web_name: c.web_name,
    team: c.team,
    team_id: c.team_id,
    position: c.position,
    base_price: c.price,
    is_starter: xiSet.has(c.fpl_id),
    is_captain: c.fpl_id === captainId,
    is_vice_captain: c.fpl_id === viceId,
  }));

  if (validatePlannerSquad(picks).length > 0) return null;

  let xiXpNext = 0;
  for (const id of xi) {
    const x = xpByFid[String(id)] ?? 0;
    xiXpNext += id === captainId ? x * 2 : x;
  }
  xiXpNext = Math.round(xiXpNext * 10) / 10;

  const squadCost = Math.round(squad.reduce((s, c) => s + c.price, 0) * 10) / 10;

  const gwForecastByFplId: Record<number, PlannerGwStripCell[]> = {};
  const nextGwXpByFplId: Record<number, number> = {};
  for (const c of squad) {
    gwForecastByFplId[c.fpl_id] = c.by_gw;
    const mult =
      xiSet.has(c.fpl_id) && c.fpl_id === captainId ? 2 : 1;
    nextGwXpByFplId[c.fpl_id] =
      Math.round(c.xp_next * mult * 10) / 10;
  }

  return {
    targetGw: fromGw,
    currentGw: current,
    picks,
    captainId,
    viceId,
    xiXpNext,
    squadCost,
    gwForecastByFplId,
    nextGwXpByFplId,
  };
}

/**
 * Next planning GW: maximize next-GW xP with a valid 15 (2/5/5/3, max three per club),
 * then best legal XI + C/V (same projection engine as Planner). No budget cap — cost is shown for info only.
 * Cached to avoid recomputing full-league projections on every home page view.
 */
export const getShowcaseRecommendedSquad = unstable_cache(
  computeShowcaseRecommendedSquadUncached,
  ["showcase-recommended-squad-v2"],
  { revalidate: 600 },
);
