/**
 * Deterministic contest GW decision engine (no LLM).
 *
 * Pipeline: validate squad → project → optional 1–2 transfers → Best XI →
 * captain/vice → chip gate for this GW.
 */
import { chunkArray } from "@/lib/chunk";
import type { PlannerPickPayload } from "@/components/planner/types";
import { findBestXiByXp } from "@/lib/planner/optimize-xi";
import { validatePlannerSquad } from "@/lib/planner/validate";
import { getServerSupabase } from "@/lib/supabase";
import {
  projectPlayers,
  resolveCurrentGw,
  riskAdjustedXP,
  XP_SCORING_NOTE,
  type PlayerProjection,
} from "@/lib/xp";
import {
  CONTEST_ALGORITHM_VERSION,
  type ContestChipId,
  type ContestDecideRequest,
  type ContestDecideResponse,
  type ContestPlayerRef,
  type ContestSquadPlayer,
  type ContestTransferMove,
} from "./types";

const POS_NEED = { GKP: 2, DEF: 5, MID: 5, FWD: 3 } as const;
const PROJ_CHUNK = 80;

type StaticRow = {
  fpl_id: number;
  web_name: string;
  team: string | null;
  team_id: number | null;
  position: "GKP" | "DEF" | "MID" | "FWD";
  base_price: number;
  minutes: number;
  status: string;
  chance_of_playing: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function isAvailable(status: string | null, chance: unknown): boolean {
  const s = status ?? "a";
  if (s === "u" || s === "n" || s === "s") return false;
  if (typeof chance === "number" && chance < 75) return false;
  return true;
}

function toRef(p: PlayerProjection, xpOverride?: number): ContestPlayerRef {
  return {
    fpl_id: p.fpl_id,
    web_name: p.web_name ?? `#${p.fpl_id}`,
    position: p.position,
    team: p.team,
    team_id: p.team_id,
    price: p.price,
    xp: round2(xpOverride ?? p.xp_total),
  };
}

function gwXp(p: PlayerProjection | undefined, gw: number): number {
  if (!p) return 0;
  return p.fixtures
    .filter((f) => f.gw === gw)
    .reduce((s, f) => s + f.xp_total, 0);
}

function parseRequest(body: unknown): ContestDecideRequest {
  if (!body || typeof body !== "object") {
    throw new ContestHttpError(400, "JSON body required.");
  }
  const b = body as Record<string, unknown>;
  const gw = Number(b.gw);
  if (!Number.isFinite(gw) || gw < 1 || gw > 38) {
    throw new ContestHttpError(400, "gw must be 1–38.");
  }
  const bank = Number(b.bank);
  if (!Number.isFinite(bank) || bank < -0.05) {
    throw new ContestHttpError(400, "bank must be a non-negative £m number.");
  }
  const freeTransfers = Number(b.freeTransfers ?? b.free_transfers ?? 1);
  if (!Number.isFinite(freeTransfers) || freeTransfers < 0 || freeTransfers > 5) {
    throw new ContestHttpError(400, "freeTransfers must be 0–5.");
  }
  const squadRaw = b.squad;
  if (!Array.isArray(squadRaw) || squadRaw.length !== 15) {
    throw new ContestHttpError(400, "squad must be an array of exactly 15 players.");
  }
  const squad: ContestSquadPlayer[] = squadRaw.map((row, i) => {
    if (!row || typeof row !== "object") {
      throw new ContestHttpError(400, `squad[${i}] invalid.`);
    }
    const r = row as Record<string, unknown>;
    const fpl_id = Number(r.fpl_id);
    if (!Number.isFinite(fpl_id) || fpl_id <= 0) {
      throw new ContestHttpError(400, `squad[${i}].fpl_id invalid.`);
    }
    const sell =
      r.sell_price != null
        ? Number(r.sell_price)
        : r.sellPrice != null
          ? Number(r.sellPrice)
          : undefined;
    if (sell != null && (!Number.isFinite(sell) || sell < 3.5)) {
      throw new ContestHttpError(400, `squad[${i}].sell_price invalid.`);
    }
    return {
      fpl_id,
      sell_price: sell,
      web_name: typeof r.web_name === "string" ? r.web_name : undefined,
      position: r.position as ContestSquadPlayer["position"],
      team_id: r.team_id != null ? Number(r.team_id) : undefined,
    };
  });
  const ids = new Set(squad.map((p) => p.fpl_id));
  if (ids.size !== 15) {
    throw new ContestHttpError(400, "squad must contain 15 unique fpl_ids.");
  }

  const chipsRemaining = normalizeChips(b.chipsRemaining ?? b.chips_remaining);
  const horizon = Math.min(Math.max(Number(b.horizon ?? 5) || 5, 1), 8);
  const riskMode =
    b.riskMode === "chase" || b.riskMode === "protect" || b.riskMode === "neutral"
      ? b.riskMode
      : "neutral";
  const allowHits = Boolean(b.allowHits ?? b.allow_hits ?? false);
  const autoPlayChips = Boolean(b.autoPlayChips ?? b.auto_play_chips ?? false);
  const outPositions = Array.isArray(b.outPositions)
    ? (b.outPositions as ContestDecideRequest["outPositions"])
    : Array.isArray(b.out_positions)
      ? (b.out_positions as ContestDecideRequest["outPositions"])
      : undefined;
  const minCandidateMinutes = Number(b.minCandidateMinutes ?? b.min_candidate_minutes ?? 270);

  return {
    gw,
    bank: round1(bank),
    freeTransfers: Math.floor(freeTransfers),
    chipsRemaining,
    squad,
    horizon,
    riskMode,
    allowHits,
    autoPlayChips,
    outPositions,
    minCandidateMinutes: Number.isFinite(minCandidateMinutes)
      ? Math.max(0, Math.floor(minCandidateMinutes))
      : 270,
  };
}

function normalizeChips(raw: unknown): ContestChipId[] {
  if (!Array.isArray(raw)) return [];
  const out: ContestChipId[] = [];
  for (const c of raw) {
    const id = String(c)
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
    if (id === "wildcard" || id === "wc") out.push("wildcard");
    else if (id === "freehit" || id === "ff") out.push("freehit");
    else if (id === "bboost" || id === "benchboost") out.push("bboost");
    else if (id === "3xc" || id === "triplecaptain") out.push("3xc");
  }
  return [...new Set(out)];
}

export class ContestHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function loadStaticByIds(ids: number[]): Promise<Map<number, StaticRow>> {
  const supa = getServerSupabase();
  const out = new Map<number, StaticRow>();
  for (const chunk of chunkArray(ids, 80)) {
    const { data, error } = await supa
      .from("players_static")
      .select(
        "fpl_id,web_name,name,team,team_id,position,base_price,minutes,status,chance_of_playing",
      )
      .in("fpl_id", chunk);
    if (error) throw new ContestHttpError(502, `players_static: ${error.message}`);
    for (const r of data ?? []) {
      const pos = r.position as string | null;
      if (!pos || !["GKP", "DEF", "MID", "FWD"].includes(pos)) continue;
      out.set(r.fpl_id as number, {
        fpl_id: r.fpl_id as number,
        web_name:
          (r.web_name as string | null) ??
          (r.name as string | null) ??
          `#${r.fpl_id}`,
        team: (r.team as string | null) ?? null,
        team_id: (r.team_id as number | null) ?? null,
        position: pos as StaticRow["position"],
        base_price: Number(r.base_price) || 0,
        minutes: Number(r.minutes) || 0,
        status: (r.status as string | null) ?? "a",
        chance_of_playing:
          r.chance_of_playing != null ? Number(r.chance_of_playing) : null,
      });
    }
  }
  return out;
}

async function loadCandidatePool(
  ownedIds: Set<number>,
  minMinutes: number,
): Promise<number[]> {
  const supa = getServerSupabase();
  let q = supa
    .from("players_static")
    .select("fpl_id,minutes,status,chance_of_playing,base_price")
    .in("position", ["GKP", "DEF", "MID", "FWD"])
    .not("team_id", "is", null)
    .lte("base_price", 15.0);
  if (minMinutes > 0) q = q.gte("minutes", minMinutes);
  const { data, error } = await q;
  if (error) throw new ContestHttpError(502, `candidate pool: ${error.message}`);
  return (data ?? [])
    .filter((r) => {
      if (ownedIds.has(r.fpl_id as number)) return false;
      return isAvailable(
        (r.status as string | null) ?? null,
        r.chance_of_playing,
      );
    })
    .map((r) => r.fpl_id as number);
}

type SingleMove = {
  out: PlayerProjection;
  in: PlayerProjection;
  outSell: number;
  delta: number;
  spend: number;
};

function planTransfers(opts: {
  owned: PlayerProjection[];
  sellById: Map<number, number>;
  projections: Map<number, PlayerProjection>;
  ownedIds: Set<number>;
  bank: number;
  freeTransfers: number;
  allowHits: boolean;
  outPositions?: Array<"GKP" | "DEF" | "MID" | "FWD">;
}): {
  transfers: ContestTransferMove[];
  hit_cost: number;
  transfer_delta: number;
  bank_after: number;
  free_transfers_after: number;
  nextOwned: PlayerProjection[];
} {
  const {
    owned,
    sellById,
    projections,
    ownedIds,
    bank,
    freeTransfers,
    allowHits,
    outPositions,
  } = opts;

  const clubCount = new Map<number, number>();
  for (const p of owned) {
    if (p.team_id != null) {
      clubCount.set(p.team_id, (clubCount.get(p.team_id) ?? 0) + 1);
    }
  }

  const singles: SingleMove[] = [];
  for (const outP of owned) {
    if (
      outPositions &&
      outP.position &&
      !outPositions.includes(outP.position as "GKP" | "DEF" | "MID" | "FWD")
    ) {
      continue;
    }
    const outSell = sellById.get(outP.fpl_id) ?? outP.price ?? 0;
    const budget = outSell + bank;

    for (const cand of projections.values()) {
      if (ownedIds.has(cand.fpl_id)) continue;
      if (cand.position !== outP.position) continue;
      const inPrice = cand.price ?? Infinity;
      if (inPrice > budget) continue;

      let club_ok = true;
      if (cand.team_id != null) {
        const after =
          (clubCount.get(cand.team_id) ?? 0) +
          1 -
          (outP.team_id === cand.team_id ? 1 : 0);
        if (after > 3) club_ok = false;
      }
      if (!club_ok) continue;

      const delta = cand.xp_total - outP.xp_total;
      if (delta <= 0.15) continue;

      singles.push({
        out: outP,
        in: cand,
        outSell,
        delta: round2(delta),
        spend: round1(inPrice - outSell),
      });
    }
  }
  singles.sort((a, b) => b.delta - a.delta);

  const bestSingle = singles[0] ?? null;

  let bestPair: {
    moves: SingleMove[];
    hit: number;
    net: number;
    raw: number;
  } | null = null;

  if (allowHits || freeTransfers >= 2) {
    const TOP_K = 25;
    const topPerOut = new Map<number, SingleMove[]>();
    for (const m of singles) {
      const arr = topPerOut.get(m.out.fpl_id) ?? [];
      if (arr.length < TOP_K) {
        arr.push(m);
        topPerOut.set(m.out.fpl_id, arr);
      }
    }
    const outList = [...topPerOut.keys()];
    for (let i = 0; i < outList.length; i++) {
      for (let j = i + 1; j < outList.length; j++) {
        for (const m1 of topPerOut.get(outList[i]) ?? []) {
          for (const m2 of topPerOut.get(outList[j]) ?? []) {
            if (m1.in.fpl_id === m2.in.fpl_id) continue;
            const spend = m1.spend + m2.spend;
            if (spend > bank + 1e-9) continue;

            const clubDelta = new Map<number, number>();
            for (const m of [m1, m2]) {
              if (m.out.team_id != null) {
                clubDelta.set(
                  m.out.team_id,
                  (clubDelta.get(m.out.team_id) ?? 0) - 1,
                );
              }
              if (m.in.team_id != null) {
                clubDelta.set(
                  m.in.team_id,
                  (clubDelta.get(m.in.team_id) ?? 0) + 1,
                );
              }
            }
            let ok = true;
            for (const [tid, d] of clubDelta) {
              if ((clubCount.get(tid) ?? 0) + d > 3) {
                ok = false;
                break;
              }
            }
            if (!ok) continue;

            const raw = m1.delta + m2.delta;
            const hit = freeTransfers >= 2 ? 0 : 4;
            if (hit > 0 && !allowHits) continue;
            const net = raw - hit;
            if (!bestPair || net > bestPair.net) {
              bestPair = { moves: [m1, m2], hit, net: round2(net), raw: round2(raw) };
            }
          }
        }
      }
    }
  }

  const usePair =
    bestPair &&
    bestPair.net > (bestSingle?.delta ?? 0) + 0.25 &&
    (bestPair.hit === 0 || allowHits);

  let chosen: SingleMove[] = [];
  let hit_cost = 0;
  let transfer_delta = 0;

  // No free transfer and hits disallowed → hold.
  if (freeTransfers <= 0 && !allowHits) {
    return {
      transfers: [],
      hit_cost: 0,
      transfer_delta: 0,
      bank_after: bank,
      free_transfers_after: 0,
      nextOwned: [...owned],
    };
  }

  if (usePair && bestPair) {
    chosen = bestPair.moves;
    hit_cost = bestPair.hit;
    transfer_delta = bestPair.net;
  } else if (bestSingle && bestSingle.delta > 0.5) {
    // Single transfer: free if FT≥1, else −4 only when allowHits.
    if (freeTransfers >= 1) {
      chosen = [bestSingle];
      hit_cost = 0;
      transfer_delta = bestSingle.delta;
    } else if (allowHits && bestSingle.delta > 4.5) {
      chosen = [bestSingle];
      hit_cost = 4;
      transfer_delta = round2(bestSingle.delta - 4);
    }
  }

  // Apply to owned list
  let nextOwned = [...owned];
  let bank_after = bank;
  for (const m of chosen) {
    nextOwned = nextOwned.map((p) => (p.fpl_id === m.out.fpl_id ? m.in : p));
    bank_after = round1(bank_after - m.spend);
  }

  const transfers: ContestTransferMove[] = chosen.map((m) => ({
    out_fpl_id: m.out.fpl_id,
    out_web_name: m.out.web_name ?? `#${m.out.fpl_id}`,
    in_fpl_id: m.in.fpl_id,
    in_web_name: m.in.web_name ?? `#${m.in.fpl_id}`,
    position: m.out.position ?? "?",
    xp_delta: m.delta,
    spend_m: m.spend,
  }));

  const usedFt = Math.min(chosen.length, freeTransfers);
  const free_transfers_after = Math.max(0, freeTransfers - usedFt);

  return {
    transfers,
    hit_cost,
    transfer_delta,
    bank_after,
    free_transfers_after,
    nextOwned,
  };
}

function pickChip(opts: {
  gw: number;
  chipsRemaining: ContestChipId[];
  xi: ContestPlayerRef[];
  bench: ContestPlayerRef[];
  captain: ContestPlayerRef | null;
  autoPlayChips: boolean;
}): {
  chip: ContestChipId | null;
  notes: ContestDecideResponse["chip_notes"];
} {
  const { gw, chipsRemaining, xi, bench, captain, autoPlayChips } = opts;
  const rem = new Set(chipsRemaining);
  const xiXp = xi.reduce((s, p) => s + p.xp, 0);
  const benchXp = bench.reduce((s, p) => s + p.xp, 0);
  const capXp = captain?.xp ?? 0;

  const notes: ContestDecideResponse["chip_notes"] = {
    triple_captain: null,
    bench_boost: null,
    wildcard: null,
    freehit: null,
  };

  if (rem.has("3xc")) {
    notes.triple_captain =
      capXp >= 7
        ? `GW${gw}: captain xP ${capXp.toFixed(1)} — strong TC window.`
        : `GW${gw}: captain xP ${capXp.toFixed(1)} — hold TC for a better haul.`;
  }
  if (rem.has("bboost")) {
    notes.bench_boost =
      benchXp >= 12
        ? `GW${gw}: bench xP ${benchXp.toFixed(1)} — solid BB candidate.`
        : `GW${gw}: bench xP ${benchXp.toFixed(1)} — hold BB (light bench / wait for DGW).`;
  }
  if (rem.has("wildcard")) {
    notes.wildcard =
      "Wildcard not auto-played in v1 — use when 4+ starters are injured/blanking.";
  }
  if (rem.has("freehit")) {
    notes.freehit =
      "Free Hit not auto-played in v1 — reserve for blank/double gameweeks.";
  }

  let chip: ContestChipId | null = null;
  if (autoPlayChips) {
    if (rem.has("3xc") && capXp >= 7.5) chip = "3xc";
    else if (rem.has("bboost") && benchXp >= 14 && xiXp >= 40) chip = "bboost";
  }

  return { chip, notes };
}

/**
 * Run a full contest decide for organizer-supplied state.
 */
export async function decideContestGw(
  rawBody: unknown,
): Promise<ContestDecideResponse> {
  const req = parseRequest(rawBody);
  const staticMap = await loadStaticByIds(req.squad.map((p) => p.fpl_id));

  for (const p of req.squad) {
    if (!staticMap.has(p.fpl_id)) {
      throw new ContestHttpError(
        400,
        `Unknown or unavailable fpl_id ${p.fpl_id} in players_static.`,
      );
    }
  }

  const picksLike = req.squad.map((p) => {
    const meta = staticMap.get(p.fpl_id)!;
    return {
      team_id: meta.team_id,
      position: meta.position,
    };
  });
  const issues = validatePlannerSquad(picksLike);
  if (issues.length) {
    throw new ContestHttpError(
      400,
      `Illegal squad: ${issues.map((i) => i.message).join(" ")}`,
    );
  }

  // Position counts already validated; also enforce NEED explicitly for clarity.
  const byPos = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of req.squad) {
    byPos[staticMap.get(p.fpl_id)!.position] += 1;
  }
  for (const pos of Object.keys(POS_NEED) as Array<keyof typeof POS_NEED>) {
    if (byPos[pos] !== POS_NEED[pos]) {
      throw new ContestHttpError(
        400,
        `${pos}: need ${POS_NEED[pos]}, have ${byPos[pos]}.`,
      );
    }
  }

  const { current } = await resolveCurrentGw();
  const fromGw = req.gw;
  const toGw = req.gw + req.horizon! - 1;

  const ownedIds = new Set(req.squad.map((p) => p.fpl_id));
  const candidateIds = await loadCandidatePool(
    ownedIds,
    req.minCandidateMinutes ?? 270,
  );
  const allIds = [...new Set([...ownedIds, ...candidateIds])];

  const projections = new Map<number, PlayerProjection>();
  for (const chunk of chunkArray(allIds, PROJ_CHUNK)) {
    const partial = await projectPlayers(chunk, {
      currentGw: current,
      fromGw,
      toGw,
    });
    for (const [id, row] of partial) projections.set(id, row);
  }

  const sellById = new Map<number, number>();
  for (const p of req.squad) {
    const meta = staticMap.get(p.fpl_id)!;
    const sell =
      p.sell_price ??
      projections.get(p.fpl_id)?.price ??
      meta.base_price;
    sellById.set(p.fpl_id, sell);
  }

  const owned = req.squad
    .map((p) => projections.get(p.fpl_id))
    .filter((p): p is PlayerProjection => Boolean(p));
  if (owned.length !== 15) {
    throw new ContestHttpError(
      502,
      `Could not project full squad (${owned.length}/15).`,
    );
  }

  const plan = planTransfers({
    owned,
    sellById,
    projections,
    ownedIds,
    bank: req.bank,
    freeTransfers: req.freeTransfers,
    allowHits: Boolean(req.allowHits),
    outPositions: req.outPositions,
  });

  // Best XI on post-transfer 15 using THIS gw xP
  const plannerPicks: PlannerPickPayload[] = plan.nextOwned.map((p, i) => ({
    slot: i + 1,
    fpl_id: p.fpl_id,
    web_name: p.web_name,
    team: p.team,
    team_id: p.team_id,
    position: p.position,
    base_price: p.price,
    is_starter: false,
    is_captain: false,
    is_vice_captain: false,
  }));

  const xpByFid: Record<string, number> = {};
  for (const p of plan.nextOwned) {
    xpByFid[String(p.fpl_id)] = gwXp(p, req.gw);
  }

  const xiIds = findBestXiByXp(plannerPicks, xpByFid);
  if (!xiIds) {
    throw new ContestHttpError(502, "Failed to form a legal Best XI.");
  }
  const xiSet = new Set(xiIds);
  const byId = new Map(plan.nextOwned.map((p) => [p.fpl_id, p]));

  const posOrder: Record<string, number> = {
    GKP: 0,
    DEF: 1,
    MID: 2,
    FWD: 3,
  };
  const startingXi = xiIds
    .map((id) => byId.get(id)!)
    .sort(
      (a, b) =>
        (posOrder[a.position ?? ""] ?? 9) - (posOrder[b.position ?? ""] ?? 9) ||
        gwXp(b, req.gw) - gwXp(a, req.gw),
    )
    .map((p) => toRef(p, gwXp(p, req.gw)));

  const benchOrder = plan.nextOwned
    .filter((p) => !xiSet.has(p.fpl_id))
    .sort((a, b) => gwXp(b, req.gw) - gwXp(a, req.gw))
    .map((p) => toRef(p, gwXp(p, req.gw)));

  // Captain among XI
  const riskMode = req.riskMode ?? "neutral";
  const rankedCaps = startingXi
    .map((s) => {
      const proj = byId.get(s.fpl_id)!;
      const xp = gwXp(proj, req.gw);
      return {
        ref: toRef(proj, xp),
        adj: riskAdjustedXP(xp, proj.ownership, riskMode),
      };
    })
    .sort((a, b) => b.adj - a.adj);

  const captain = rankedCaps[0]?.ref ?? null;
  const vice = rankedCaps[1]?.ref ?? null;
  const chipPick = pickChip({
    gw: req.gw,
    chipsRemaining: req.chipsRemaining ?? [],
    xi: startingXi,
    bench: benchOrder,
    captain,
    autoPlayChips: Boolean(req.autoPlayChips),
  });

  const tcMult = chipPick.chip === "3xc" ? 3 : 2;
  const xi_gw = round2(startingXi.reduce((s, p) => s + p.xp, 0));
  const bench_gw = round2(benchOrder.reduce((s, p) => s + p.xp, 0));
  const captain_ev = captain ? round2(captain.xp * tcMult) : 0;

  const rationaleParts: string[] = [];
  if (plan.transfers.length === 0) {
    rationaleParts.push("No transfer — hold squad; set Best XI + captain.");
  } else if (plan.transfers.length === 1) {
    const t = plan.transfers[0];
    rationaleParts.push(
      `1 transfer: ${t.out_web_name} → ${t.in_web_name} (+${t.xp_delta} xP / ${req.horizon}GW).`,
    );
  } else {
    rationaleParts.push(
      `2 transfers (hit ${plan.hit_cost}): ${plan.transfers
        .map((t) => `${t.out_web_name}→${t.in_web_name}`)
        .join(", ")} (net +${plan.transfer_delta} xP).`,
    );
  }
  if (captain) {
    rationaleParts.push(
      `Captain ${captain.web_name} (xP ${captain.xp.toFixed(1)}; EV ${captain_ev.toFixed(1)}).`,
    );
  }
  if (chipPick.chip) {
    rationaleParts.push(`Activate chip: ${chipPick.chip}.`);
  } else {
    rationaleParts.push("No chip this GW.");
  }

  return {
    algorithmVersion: CONTEST_ALGORITHM_VERSION,
    gw: req.gw,
    horizon: req.horizon!,
    fromGw,
    toGw,
    bank_after: plan.bank_after,
    free_transfers_after: plan.free_transfers_after,
    hit_cost: plan.hit_cost,
    transfers: plan.transfers,
    startingXi,
    benchOrder,
    captain,
    vice,
    chip: chipPick.chip,
    chip_notes: chipPick.notes,
    xpSummary: {
      xi_gw,
      bench_gw,
      captain_ev,
      transfer_delta_horizon: plan.transfer_delta,
    },
    rationale: rationaleParts.join(" "),
    scoring: XP_SCORING_NOTE,
  };
}
