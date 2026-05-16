import type { PlannerPickPayload } from "@/components/planner/types";
import type { PlannerGwStripCell } from "@/components/planner/pitch-view";
import {
  findBestStartingElevenFromPool,
} from "@/lib/planner/optimize-xi";
import { countByPosition, countByTeam, validatePlannerSquad } from "@/lib/planner/validate";
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

/** Top-N per line into search pool (C(n,11) must stay fast on cold start). */
const POOL_LIMITS: Record<Pos, number> = {
  GKP: 4,
  DEF: 7,
  MID: 7,
  FWD: 6,
};

export type ShowcaseRecommendedSquad = {
  targetGw: number;
  currentGw: number;
  picks: PlannerPickPayload[];
  captainId: number | null;
  viceId: number | null;
  /** Next-GW FPL score: XI xP with captain on best starter (same objective as search). */
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

function orderStarters(squad: Cand[], xi: Set<number>): Cand[] {
  const st = squad.filter((c) => xi.has(c.fpl_id));
  const line = (pos: Pos) =>
    st
      .filter((c) => c.position === pos)
      .sort((a, b) => b.xp_next - a.xp_next || a.price - b.price);
  return [...line("GKP"), ...line("DEF"), ...line("MID"), ...line("FWD")];
}

function orderBench(bench: Cand[]): Cand[] {
  const gk = bench.filter((c) => c.position === "GKP");
  const of = bench
    .filter((c) => c.position !== "GKP")
    .sort((a, b) => b.xp_next - a.xp_next || a.price - b.price);
  return [...gk, ...of];
}

function buildSearchPool(byPos: Record<Pos, Cand[]>): PlannerPickPayload[] {
  const poolMap = new Map<number, PlannerPickPayload>();
  let slot = 1;
  for (const pos of POS_ORDER) {
    for (const c of byPos[pos].slice(0, POOL_LIMITS[pos])) {
      if (poolMap.has(c.fpl_id)) continue;
      poolMap.set(c.fpl_id, {
        slot: slot++,
        fpl_id: c.fpl_id,
        web_name: c.web_name,
        team: c.team,
        team_id: c.team_id,
        position: c.position,
        base_price: c.price,
        is_starter: false,
        is_captain: false,
        is_vice_captain: false,
      });
    }
  }
  return [...poolMap.values()];
}

/** Four bench slots: fill remaining position counts, max 3 per club, highest xP first. */
function fillBench(
  xiPayloads: PlannerPickPayload[],
  byPos: Record<Pos, Cand[]>,
): Cand[] | null {
  const xiIds = new Set(xiPayloads.map((p) => p.fpl_id));
  const need = { ...NEED_FULL };
  const xiCounts = countByPosition(xiPayloads);
  for (const pos of POS_ORDER) {
    need[pos] -= xiCounts[pos] ?? 0;
  }
  const team = countByTeam(xiPayloads);
  const flat: Cand[] = [];
  for (const pos of POS_ORDER) {
    for (const c of byPos[pos]) {
      if (!xiIds.has(c.fpl_id)) flat.push(c);
    }
  }
  flat.sort(
    (a, b) => b.xp_next - a.xp_next || a.price - b.price,
  );
  const bench: Cand[] = [];
  for (const c of flat) {
    if (bench.length >= 4) break;
    const pos = c.position;
    if (need[pos] <= 0) continue;
    const tid = c.team_id ?? -1;
    if (tid >= 0 && (team.get(tid) ?? 0) >= 3) continue;
    bench.push(c);
    need[pos] -= 1;
    if (tid >= 0) {
      team.set(tid, (team.get(tid) ?? 0) + 1);
    }
  }
  if (bench.length < 4) return null;
  return bench;
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

  /** Same `currentGw` / `fromGw` contract as `/api/planner/project` (Planner client). */
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

  const candByFid = new Map<number, Cand>();
  for (const pos of POS_ORDER) {
    for (const c of byPos[pos]) {
      candByFid.set(c.fpl_id, c);
    }
  }

  const pool = buildSearchPool(byPos);
  if (pool.length < 11) return null;

  const xpByFid: Record<string, number> = {};
  for (const p of pool) {
    xpByFid[String(p.fpl_id)] = candByFid.get(p.fpl_id)!.xp_next;
  }

  const found = findBestStartingElevenFromPool(pool, xpByFid);
  if (!found) return null;

  const xiPayloads = found.xi;
  const xiSet = new Set(xiPayloads.map((p) => p.fpl_id));

  let captainId: number | null = null;
  let best = -1;
  for (const p of xiPayloads) {
    const x = xpByFid[String(p.fpl_id)] ?? 0;
    if (x > best) {
      best = x;
      captainId = p.fpl_id;
    }
  }
  let viceId: number | null = null;
  let second = -1;
  for (const p of xiPayloads) {
    if (p.fpl_id === captainId) continue;
    const x = xpByFid[String(p.fpl_id)] ?? 0;
    if (x > second) {
      second = x;
      viceId = p.fpl_id;
    }
  }

  const benchCands = fillBench(xiPayloads, byPos);
  if (!benchCands) return null;

  const xiCands = xiPayloads
    .map((p) => candByFid.get(p.fpl_id))
    .filter((c): c is Cand => c != null);
  const startersOrdered = orderStarters(xiCands, xiSet);
  const benchOrdered = orderBench(benchCands);
  const orderedCands = [...startersOrdered, ...benchOrdered];

  const picks: PlannerPickPayload[] = orderedCands.map((c, i) => ({
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

  const xiXpNext = Math.round(found.score * 10) / 10;

  const squad = [...xiCands, ...benchCands];
  const squadCost =
    Math.round(squad.reduce((s, c) => s + c.price, 0) * 10) / 10;

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
 * Home-page “Best XI”: same projection contract as Planner (`/api/planner/project`),
 * then search a ~22-player pool for the legal XI that maximises next-GW FPL score
 * with optimal captain (`sum(xp) + max(xp)`). Bench = four best fillers for a valid 15.
 */
export const getShowcaseRecommendedSquad = unstable_cache(
  computeShowcaseRecommendedSquadUncached,
  ["showcase-recommended-squad-v4"],
  { revalidate: 600 },
);
