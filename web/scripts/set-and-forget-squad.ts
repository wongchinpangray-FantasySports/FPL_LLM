/**
 * Set-and-forget FPL squad picker.
 *
 * Contest constraints: no transfers · locked XI preference · locked captain · no chips.
 *
 * Ranking factors:
 *  1. Minutes reliability (prior starts + expected mins)
 *  2. Set-piece roles first (pens > FK > corners)
 *  3. FDR quality + DEF fixture complementarity ("FDR rotation" without weekly swaps)
 *  4. Horizon xP with locked captain double
 *
 *   cd web && npx tsx scripts/set-and-forget-squad.ts
 *   cd web && npx tsx scripts/set-and-forget-squad.ts --horizon=15
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chunkArray } from "../lib/chunk";
import { getServerSupabase } from "../lib/supabase";
import {
  loadOfficialFplPlayerIdSet,
  normalizeInsightPlayerRows,
} from "../lib/fpl/insights/dedupe";
import { buildFplFixtureGrid } from "../lib/fpl/fixtures-grid";
import { findBestXiByXp } from "../lib/planner/optimize-xi";
import type { PlannerPickPayload } from "../components/planner/types";
import { SQUAD_BUILDER_BUDGET_M } from "../lib/squad-builder/slots";
import {
  projectPlayers,
  resolveCurrentGw,
  type PlayerProjection,
} from "../lib/xp";
import { buildBudgetSquad } from "../lib/fpl/daily-gw1-draft";
import { loadScriptEnv } from "./load-env";

loadScriptEnv();

const NEED = { GKP: 2, DEF: 5, MID: 5, FWD: 3 } as const;
const PROJ_CHUNK = 80;
const MIN_AVG_EXPECTED_MINS = 60;
const CAPTAIN_MIN_AVG_MINS = 75;
const PRIOR_MINUTES_SOFT = 1500;
const MIN_PRIOR_STARTS_XI = 20;
const MIN_PRIOR_MINUTES_XI = 1500;

/** New-club DEF minutes risk — exclude from set-and-forget pool. */
const NEW_CLUB_DEF = /^(Senesi|Lacroix|Gu[eé]hi|Van Hecke|Mukiele)$/i;

/** New-club / contested GK — Spurs #1 unclear (Dubravka vs Vicario). */
const CONTESTED_GKP = /^(Dubravka)$/i;

/** Big-club MID rotation traps at mid-price. */
const ROTATION_TRAP_MID_TEAMS = new Set([
  "Man City",
  "Manchester City",
  "Liverpool",
  "Arsenal",
  "Chelsea",
]);

type Pos = "GKP" | "DEF" | "MID" | "FWD";

type Cand = {
  fpl_id: number;
  web_name: string;
  team: string;
  team_id: number;
  team_code: number | null;
  team_short: string;
  position: Pos;
  price: number;
  xp_gw1: number;
  xp_horizon: number;
  avg_expected_minutes: number;
  prior_minutes: number;
  prior_starts: number;
  ownership: number;
  status: string;
  penalties_order: number | null;
  freekicks_order: number | null;
  corners_order: number | null;
  set_piece_score: number;
  team_avg_fdr: number;
  /** Season defensive contribution total (CBI/CBIRT stack). */
  defcon_total: number;
  /** Reliable DC/90; 0 when sample too small. */
  defcon_per_90: number;
  score: number;
};

type TeamFdr = {
  short: string;
  avg: number;
  byGw: Map<number, number>;
};

function parseHorizon(): number {
  const arg = process.argv.find((a) => /^--horizon=\d+$/.test(a));
  const n = arg ? Number(arg.split("=")[1]) : 15;
  return Math.min(38, Math.max(5, Math.floor(n) || 15));
}

function isAvailable(status: string | null, chance: unknown): boolean {
  const s = status ?? "a";
  if (s === "u" || s === "n" || s === "s") return false;
  if (typeof chance === "number" && chance < 50) return false;
  return true;
}

function numOrder(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Pens >> FK >> corners. Primary (1) heavily preferred over backup (2). */
function setPieceScore(
  pen: number | null,
  fk: number | null,
  corners: number | null,
): number {
  let s = 0;
  if (pen === 1) s += 28;
  else if (pen === 2) s += 10;
  if (fk === 1) s += 16;
  else if (fk === 2) s += 6;
  if (corners === 1) s += 10;
  else if (corners === 2) s += 4;
  return s;
}

function setPieceLabel(c: Cand): string {
  const bits: string[] = [];
  if (c.penalties_order === 1) bits.push("P1");
  else if (c.penalties_order === 2) bits.push("P2");
  if (c.freekicks_order === 1) bits.push("FK1");
  else if (c.freekicks_order === 2) bits.push("FK2");
  if (c.corners_order === 1) bits.push("C1");
  else if (c.corners_order === 2) bits.push("C2");
  return bits.length ? bits.join("/") : "—";
}

function isRotationTrap(c: {
  position: Pos;
  team: string;
  price: number;
  web_name: string;
}): boolean {
  if (c.position !== "MID") return false;
  if (!ROTATION_TRAP_MID_TEAMS.has(c.team)) return false;
  if (c.price >= 8.5) return false;
  if (/^(Saka|Palmer|Salah|B\.Fernandes|Bruno)$/i.test(c.web_name)) return false;
  return c.price <= 7.5;
}

/** DEFCON additive score — critical for DEF/MID locked floors (≈2pts when threshold hit). */
function defconScore(
  position: Pos,
  dcPer90: number,
  dcTotal: number,
  priorMins: number,
): number {
  if (position === "GKP") return 0;
  if (priorMins < 450 || dcPer90 <= 0) return 0;
  // Thresholds: DEF 10 / MID·FWD 12 per match → “regular hitter” ≈ that per 90.
  const threshold = position === "DEF" ? 10 : 12;
  const hitRate = Math.min(dcPer90 / threshold, 1.35);
  // Weight DEF highest (CS + DC stack), then MID, light for FWD.
  const posWeight = position === "DEF" ? 22 : position === "MID" ? 14 : 5;
  const volume = Math.min(dcTotal / 200, 1.2);
  return hitRate * posWeight + volume * 6;
}

function defconLabel(c: Cand): string {
  if (c.position === "GKP" || c.defcon_per_90 <= 0) return "—";
  return `${c.defcon_per_90.toFixed(1)}/90`;
}

function reliabilityScore(opts: {
  xp: number;
  avgMins: number;
  priorMins: number;
  priorStarts: number;
  price: number;
  trap: boolean;
  setPiece: number;
  defcon: number;
  avgFdr: number;
  position: Pos;
}): number {
  const minsFactor =
    opts.avgMins >= 80 ? 1.2 : opts.avgMins >= 70 ? 1.05 : opts.avgMins >= 60 ? 0.7 : 0.3;
  const priorFactor =
    opts.priorStarts >= 30 && opts.priorMins >= 2500
      ? 1.2
      : opts.priorStarts >= MIN_PRIOR_STARTS_XI &&
          opts.priorMins >= PRIOR_MINUTES_SOFT
        ? 1.08
        : opts.priorMins >= 900
          ? 0.85
          : 0.55;
  const trapFactor = opts.trap ? 0.45 : 1;
  const value = opts.xp / Math.max(opts.price, 4);
  const base =
    (opts.xp * 0.55 + value * 12) * minsFactor * priorFactor * trapFactor;
  const spBoost = opts.setPiece * 1.35;
  const dcBoost = opts.defcon * 1.25;
  const fdrWeight = opts.position === "DEF" || opts.position === "GKP" ? 1 : 0.45;
  const fdrMult = 1 + (1 + (3 - opts.avgFdr) * 0.4 - 1) * fdrWeight;
  return (base + spBoost + dcBoost) * fdrMult;
}

/** User-rejected / non-elite DEF — OK on bench, blocked from locked XI preference. */
const DEF_XI_AVOID = /^(Ballard|Botman|Hume|Alderete)$/i;

function xiSelectionScore(c: Cand): number {
  // Set-piece + DEFCON must beat pure-xP peers into the locked XI.
  const sp = c.set_piece_score * 1.1;
  const dc = defconScore(
    c.position,
    c.defcon_per_90,
    c.defcon_total,
    c.prior_minutes,
  );
  const fdr =
    c.position === "DEF" || c.position === "GKP"
      ? (3 - c.team_avg_fdr) * 8
      : (3 - c.team_avg_fdr) * 2;
  const avoid =
    c.position === "DEF" && DEF_XI_AVOID.test(c.web_name) ? -35 : 0;
  return c.xp_horizon + sp + dc + fdr + avoid;
}

/**
 * For locked DEF lines: reward weeks where at least one has easy FDR,
 * penalize weeks where all three are hard. This is "FDR rotation" without swaps.
 */
function defComplementScore(
  defs: Cand[],
  fdrByTeam: Map<number, TeamFdr>,
  fromGw: number,
  toGw: number,
): number {
  if (defs.length < 2) return 0;
  let score = 0;
  for (let gw = fromGw; gw <= toGw; gw++) {
    const fdrs = defs.map((d) => fdrByTeam.get(d.team_id)?.byGw.get(gw) ?? 3);
    const best = Math.min(...fdrs);
    const worst = Math.max(...fdrs);
    const avg = fdrs.reduce((s, n) => s + n, 0) / fdrs.length;
    if (best <= 2) score += 2.2;
    else if (best <= 3) score += 0.6;
    if (worst >= 4 && best >= 4) score -= 2.5; // stacked blank risk
    // Diversified week (spread) is good for locked multi-DEF.
    if (worst - best >= 2) score += 0.8;
    score += (3 - avg) * 0.5;
  }
  // Mild diversity bonus for distinct clubs (already enforced by 3/club, but help).
  const clubs = new Set(defs.map((d) => d.team_id));
  score += clubs.size * 1.5;
  // Penalize double-DEF from same club (worse locked FDR diversification).
  if (clubs.size < defs.length) score -= 12 * (defs.length - clubs.size);
  return score;
}

async function loadTeamFdr(
  fromGw: number,
  toGw: number,
): Promise<Map<number, TeamFdr>> {
  const grid = await buildFplFixtureGrid();
  const out = new Map<number, TeamFdr>();
  for (const row of grid.rows) {
    const window = row.fixtures.filter((f) => f.gw >= fromGw && f.gw <= toGw);
    const byGw = new Map<number, number>();
    for (const f of window) byGw.set(f.gw, f.fdr);
    const avg =
      window.length > 0
        ? window.reduce((s, f) => s + f.fdr, 0) / window.length
        : 3;
    out.set(row.team_id, { short: row.short, avg, byGw });
  }
  return out;
}

async function loadPool(horizon: number): Promise<{
  cands: Cand[];
  fromGw: number;
  toGw: number;
  currentGw: number;
  fdrByTeam: Map<number, TeamFdr>;
}> {
  const supa = getServerSupabase();
  const officialIds = await loadOfficialFplPlayerIdSet();
  const { current, next } = await resolveCurrentGw();
  const fromGw = Math.min(next, 1) === 1 || current <= 1 ? 1 : next;
  const toGw = fromGw + horizon - 1;
  const fdrByTeam = await loadTeamFdr(fromGw, toGw);

  const { data: pool, error } = await supa
    .from("players_static")
    .select(
      "fpl_id,web_name,name,team,team_id,position,base_price,selected_by_percent,status,chance_of_playing,minutes,starts,penalties_order,direct_freekicks_order,corners_and_indirect_freekicks_order,defensive_contribution,defensive_contribution_per_90",
    )
    .in("position", ["GKP", "DEF", "MID", "FWD"])
    .not("team_id", "is", null);

  if (error) throw new Error(error.message);

  const { data: teams } = await supa
    .from("teams")
    .select("id,short_name,code,name");
  const teamById = new Map(
    (teams ?? []).map((t) => [
      t.id as number,
      {
        short: (t.short_name as string) ?? "—",
        code: (t.code as number | null) ?? null,
        name: (t.name as string) ?? "—",
      },
    ]),
  );

  const filtered = normalizeInsightPlayerRows(
    (pool ?? [])
      .filter((r) =>
        isAvailable(
          (r.status as string | null) ?? null,
          r.chance_of_playing,
        ),
      )
      .map((r) => ({
        fpl_id: r.fpl_id as number,
        web_name:
          (r.web_name as string | null) ??
          (r.name as string) ??
          `#${r.fpl_id}`,
        team_id: (r.team_id as number | null) ?? null,
        team: (r.team as string) ?? "—",
        position: (r.position as string | null) ?? null,
        base_price: r.base_price != null ? Number(r.base_price) : null,
        selected_by_percent:
          r.selected_by_percent != null
            ? Number(r.selected_by_percent)
            : null,
        minutes: r.minutes != null ? Number(r.minutes) : 0,
        starts: r.starts != null ? Number(r.starts) : 0,
        status: (r.status as string | null) ?? "a",
        penalties_order: numOrder(r.penalties_order),
        freekicks_order: numOrder(r.direct_freekicks_order),
        corners_order: numOrder(r.corners_and_indirect_freekicks_order),
        defensive_contribution:
          r.defensive_contribution != null
            ? Number(r.defensive_contribution)
            : 0,
        defensive_contribution_per_90:
          r.defensive_contribution_per_90 != null
            ? Number(r.defensive_contribution_per_90)
            : null,
      })),
    officialIds,
  );

  const byId = new Map(filtered.map((r) => [r.fpl_id, r]));
  const ids = filtered.map((r) => r.fpl_id);
  const projections = new Map<number, PlayerProjection>();
  for (const chunk of chunkArray(ids, PROJ_CHUNK)) {
    const partial = await projectPlayers(chunk, {
      currentGw: current,
      fromGw,
      toGw,
    });
    for (const [id, row] of partial) projections.set(id, row);
  }

  const cands: Cand[] = [];
  for (const [id, p] of projections) {
    const meta = byId.get(id);
    if (!meta?.team_id || !meta.position) continue;
    if (!["GKP", "DEF", "MID", "FWD"].includes(meta.position)) continue;
    const price = meta.base_price ?? (p.price != null ? Number(p.price) : null);
    if (price == null || price < 3.5) continue;
    const name = p.web_name ?? meta.web_name;
    if (meta.position === "DEF" && NEW_CLUB_DEF.test(name)) continue;
    if (meta.position === "GKP" && CONTESTED_GKP.test(name)) continue;

    const fx = p.fixtures ?? [];
    if (fx.length === 0) continue;
    const avgMins =
      fx.reduce((s, f) => s + (f.expected_minutes ?? 0), 0) / fx.length;
    if (avgMins < MIN_AVG_EXPECTED_MINS) continue;

    const priorMins = meta.minutes ?? 0;
    const priorStarts = meta.starts ?? 0;
    // Cheap bench fodder can be softer; anyone with set-piece upside must be truly nailed.
    const spEarly = setPieceScore(
      meta.penalties_order,
      meta.freekicks_order,
      meta.corners_order,
    );
    const cheapBenchOnly = price <= 4.5 && spEarly === 0;
    if (
      !cheapBenchOnly &&
      (priorStarts < MIN_PRIOR_STARTS_XI || priorMins < MIN_PRIOR_MINUTES_XI)
    ) {
      if (!(avgMins >= 80 && priorMins >= 2000 && priorStarts >= 24)) continue;
    }
    // Hard floor for DEF XI candidates: no sub-20-start "pens LB" traps.
    if (
      meta.position === "DEF" &&
      priorStarts < 24 &&
      price >= 4.5
    ) {
      continue;
    }

    const xp = p.xp_total ?? 0;
    const gw1 = fx[0]?.xp_total ?? xp / fx.length;
    const teamMeta = teamById.get(meta.team_id);
    const teamName = teamMeta?.name ?? meta.team;
    const trap = isRotationTrap({
      position: meta.position as Pos,
      team: teamName,
      price,
      web_name: name,
    });
    const pen = meta.penalties_order;
    const fk = meta.freekicks_order;
    const corners = meta.corners_order;
    const sp = setPieceScore(pen, fk, corners);
    const avgFdr = fdrByTeam.get(meta.team_id)?.avg ?? 3;
    const dcTotal = meta.defensive_contribution ?? 0;
    const rawDc90 = meta.defensive_contribution_per_90;
    // Suppress tiny-sample DC/90 (same gate as insights).
    const dcPer90 =
      priorMins >= 450 && rawDc90 != null && Number.isFinite(rawDc90) && rawDc90 > 0
        ? rawDc90
        : priorMins >= 450 && dcTotal > 0
          ? (dcTotal / priorMins) * 90
          : 0;
    const dc = defconScore(
      meta.position as Pos,
      dcPer90,
      dcTotal,
      priorMins,
    );
    let score = reliabilityScore({
      xp,
      avgMins,
      priorMins,
      priorStarts,
      price,
      trap,
      setPiece: sp,
      defcon: dc,
      avgFdr,
      position: meta.position as Pos,
    });
    // Keep avoided DEFs available as cheap bench, but demote from spine contention.
    if (meta.position === "DEF" && DEF_XI_AVOID.test(name)) score *= 0.72;
    // User preference: João Pedro over Mateta for locked FWD.
    if (/^Mateta$/i.test(name)) score *= 0.88;
    if (/^Jo[aã]o Pedro$/i.test(name)) score *= 1.08;

    cands.push({
      fpl_id: id,
      web_name: name,
      team: teamName,
      team_id: meta.team_id,
      team_code: teamMeta?.code ?? null,
      team_short: teamMeta?.short ?? "—",
      position: meta.position as Pos,
      price,
      xp_gw1: gw1,
      xp_horizon: xp,
      avg_expected_minutes: avgMins,
      prior_minutes: priorMins,
      prior_starts: priorStarts,
      ownership: meta.selected_by_percent ?? 0,
      status: meta.status ?? "a",
      penalties_order: pen,
      freekicks_order: fk,
      corners_order: corners,
      set_piece_score: sp,
      team_avg_fdr: avgFdr,
      defcon_total: dcTotal,
      defcon_per_90: Math.round(dcPer90 * 100) / 100,
      score,
    });
  }

  cands.sort((a, b) => b.score - a.score);
  return { cands, fromGw, toGw, currentGw: current, fdrByTeam };
}

function toDraftCand(c: Cand) {
  return {
    fpl_id: c.fpl_id,
    web_name: c.web_name,
    team: c.team,
    team_id: c.team_id,
    team_code: c.team_code,
    team_short: c.team_short,
    position: c.position,
    price: c.price,
    xp_gw1: c.score,
    xp_horizon: c.xp_horizon,
    status: c.status,
  };
}

type EvalResult = {
  xi: Cand[];
  bench: Cand[];
  formation: string;
  xiXp: number;
  captainXp: number;
  totalWithCaptain: number;
  spend: number;
  defComplement: number;
};

function evaluateSquadFixed(
  squad: Cand[],
  captainId: number,
  fdrByTeam: Map<number, TeamFdr>,
  fromGw: number,
  toGw: number,
  forceStartIds: Set<number> = new Set(),
): EvalResult | null {
  if (squad.length !== 15) return null;
  const picks: PlannerPickPayload[] = squad.map((c, i) => ({
    slot: i + 1,
    fpl_id: c.fpl_id,
    web_name: c.web_name,
    team: c.team,
    team_id: c.team_id,
    position: c.position,
    base_price: c.price,
    is_starter: i < 11,
    is_captain: false,
    is_vice_captain: false,
  }));
  const xpByFid: Record<string, number> = {};
  for (const c of squad) {
    let s = xiSelectionScore(c);
    // Locked attackers / set-piece nails must start — avoid 3-5-2 benching João Pedro.
    if (forceStartIds.has(c.fpl_id)) s += 80;
    xpByFid[String(c.fpl_id)] = s;
  }

  const xiIds = findBestXiByXp(picks, xpByFid);
  if (!xiIds) return null;
  const xiSet = new Set(xiIds);
  const posOrder: Record<Pos, number> = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };
  let xi = squad
    .filter((c) => xiSet.has(c.fpl_id))
    .sort(
      (a, b) =>
        posOrder[a.position] - posOrder[b.position] ||
        b.xp_horizon - a.xp_horizon,
    );
  let bench = squad
    .filter((c) => !xiSet.has(c.fpl_id))
    .sort((a, b) => b.xp_horizon - a.xp_horizon);

  // If a force-start is still on the bench (formation edge case), swap lowest non-forced.
  for (const id of forceStartIds) {
    if (xi.some((p) => p.fpl_id === id)) continue;
    const forced = bench.find((p) => p.fpl_id === id);
    if (!forced) continue;
    const victim = [...xi]
      .filter((p) => !forceStartIds.has(p.fpl_id) && p.position !== "GKP")
      .sort((a, b) => xiSelectionScore(a) - xiSelectionScore(b))[0];
    if (!victim) continue;
    // Keep legal formation counts via simple same-position swap when possible.
    const samePos = [...xi]
      .filter(
        (p) =>
          !forceStartIds.has(p.fpl_id) && p.position === forced.position,
      )
      .sort((a, b) => xiSelectionScore(a) - xiSelectionScore(b))[0];
    const out = samePos ?? victim;
    xi = xi.filter((p) => p.fpl_id !== out.fpl_id).concat(forced);
    bench = bench.filter((p) => p.fpl_id !== forced.fpl_id).concat(out);
  }

  xi = xi.sort(
    (a, b) =>
      posOrder[a.position] - posOrder[b.position] ||
      b.xp_horizon - a.xp_horizon,
  );
  bench = bench.sort((a, b) => b.xp_horizon - a.xp_horizon);

  const captain = xi.find((c) => c.fpl_id === captainId);
  if (!captain) return null;

  const defs = xi.filter((p) => p.position === "DEF");
  const d = defs.length;
  const m = xi.filter((p) => p.position === "MID").length;
  const f = xi.filter((p) => p.position === "FWD").length;
  const xiXp = xi.reduce((s, p) => s + p.xp_horizon, 0);
  const captainXp = captain.xp_horizon;
  const complement = defComplementScore(defs, fdrByTeam, fromGw, toGw);
  const dcFloor = defs.reduce(
    (s, p) =>
      s +
      defconScore(p.position, p.defcon_per_90, p.defcon_total, p.prior_minutes),
    0,
  );
  return {
    xi,
    bench,
    formation: `${d}-${m}-${f}`,
    xiXp: Math.round(xiXp * 10) / 10,
    captainXp: Math.round(captainXp * 10) / 10,
    totalWithCaptain:
      Math.round((xiXp + captainXp + complement * 0.35 + dcFloor * 0.15) * 10) /
      10,
    spend: Math.round(squad.reduce((s, p) => s + p.price, 0) * 10) / 10,
    defComplement: Math.round(complement * 10) / 10,
  };
}

function forceSpendUpgrades(
  squad: Cand[],
  pool: Cand[],
  budget = SQUAD_BUILDER_BUDGET_M,
  protectedIds: Set<number> = new Set(),
): Cand[] {
  const out = [...squad];
  let bank = budget - out.reduce((s, p) => s + p.price, 0);
  let improved = true;
  while (improved) {
    improved = false;
    const clubCount = new Map<number, number>();
    for (const p of out) {
      clubCount.set(p.team_id, (clubCount.get(p.team_id) ?? 0) + 1);
    }
    const ids = new Set(out.map((p) => p.fpl_id));
    for (let i = 0; i < out.length; i++) {
      const cur = out[i];
      if (protectedIds.has(cur.fpl_id)) continue;
      let best: Cand | null = null;
      let bestDelta = 0.4;
      for (const c of pool) {
        if (ids.has(c.fpl_id)) continue;
        if (c.position !== cur.position) continue;
        const without = (clubCount.get(cur.team_id) ?? 1) - 1;
        const withNew =
          c.team_id === cur.team_id
            ? without + 1
            : (clubCount.get(c.team_id) ?? 0) + 1;
        if (withNew > 3) continue;
        const cost = c.price - cur.price;
        if (cost > bank + 1e-9) continue;
        // Prefer score (xP + set-piece + FDR), not raw xP alone.
        const delta = c.score - cur.score;
        if (delta > bestDelta) {
          bestDelta = delta;
          best = c;
        }
      }
      if (best) {
        bank -= best.price - cur.price;
        out[i] = best;
        improved = true;
        break;
      }
    }
  }
  return out;
}

/** Swap DEF slots to max FDR complement + set-piece, keeping budget/3-club legal. */
function optimizeDefLine(
  squad: Cand[],
  pool: Cand[],
  fdrByTeam: Map<number, TeamFdr>,
  fromGw: number,
  toGw: number,
  budget = SQUAD_BUILDER_BUDGET_M,
  protectedIds: Set<number> = new Set(),
): Cand[] {
  const out = [...squad];
  const defIdx = out
    .map((c, i) => (c.position === "DEF" ? i : -1))
    .filter((i) => i >= 0);
  if (defIdx.length !== NEED.DEF) return out;

  const defPool = pool
    .filter((c) => c.position === "DEF" && !DEF_XI_AVOID.test(c.web_name))
    .sort((a, b) => b.score - a.score)
    .slice(0, 45);

  const scoreLine = (defs: Cand[]) => {
    const xp = defs.reduce((s, d) => s + d.xp_horizon, 0);
    const sp = defs.reduce((s, d) => s + d.set_piece_score, 0);
    const dc = defs.reduce(
      (s, d) =>
        s +
        defconScore(
          d.position,
          d.defcon_per_90,
          d.defcon_total,
          d.prior_minutes,
        ),
      0,
    );
    const comp = defComplementScore(defs, fdrByTeam, fromGw, toGw);
    const avoidPen = defs.reduce(
      (s, d) => s + (DEF_XI_AVOID.test(d.web_name) ? -40 : 0),
      0,
    );
    return xp + sp * 1.2 + dc * 1.15 + comp * 0.55 + avoidPen;
  };

  let best = out;
  let bestScore = scoreLine(defIdx.map((i) => out[i]));

  // Greedy local search: try replacing each unprotected DEF with pool options.
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 40) {
    improved = false;
    const cur = [...best];
    const spendOthers = cur
      .filter((c) => c.position !== "DEF")
      .reduce((s, p) => s + p.price, 0);
    const nonDefClubs = new Map<number, number>();
    for (const p of cur) {
      if (p.position === "DEF") continue;
      nonDefClubs.set(p.team_id, (nonDefClubs.get(p.team_id) ?? 0) + 1);
    }

    for (const i of defIdx) {
      if (protectedIds.has(cur[i].fpl_id)) continue;
      for (const cand of defPool) {
        if (cur.some((p) => p.fpl_id === cand.fpl_id)) continue;
        const trialDefs = defIdx.map((j) => (j === i ? cand : cur[j]));
        const trialSpend =
          spendOthers + trialDefs.reduce((s, d) => s + d.price, 0);
        if (trialSpend > budget + 1e-9) continue;
        const clubs = new Map(nonDefClubs);
        for (const d of trialDefs) {
          clubs.set(d.team_id, (clubs.get(d.team_id) ?? 0) + 1);
        }
        if ([...clubs.values()].some((n) => n > 3)) continue;
        const sc = scoreLine(trialDefs);
        if (sc > bestScore + 0.3) {
          const next = [...cur];
          next[i] = cand;
          best = next;
          bestScore = sc;
          improved = true;
        }
      }
    }
  }
  return best;
}

type Strategy = {
  id: string;
  title: string;
  mustIncludeHints: RegExp[];
  captainHint: RegExp;
  preferValue: boolean;
};

const STRATEGIES: Strategy[] = [
  {
    id: "contest-final",
    title: "Contest submit · Petrović + Richards + Rodon",
    mustIncludeHints: [
      /^Haaland$/i,
      /^Jo[aã]o Pedro$/i,
      /^Saka$/i,
      /^Virgil$/i,
      /^Petrovi[cć]$/i,
      /^Richards$/i,
      /^Rodon$/i,
    ],
    captainHint: /^Haaland$/i,
    preferValue: false,
  },
  {
    id: "haaland-pedro-defcon",
    title: "Haaland (C) · João Pedro · DEFCON backs",
    mustIncludeHints: [
      /^Haaland$/i,
      /^Jo[aã]o Pedro$/i,
      /^Saka$/i,
      /^Virgil$/i,
      /^Petrovi[cć]$/i,
      /^Richards$/i,
    ],
    captainHint: /^Haaland$/i,
    preferValue: false,
  },
  {
    id: "haaland-pedro-gabriel-virgil",
    title: "Haaland (C) · João Pedro · Gabriel+Virgil",
    mustIncludeHints: [
      /^Haaland$/i,
      /^Jo[aã]o Pedro$/i,
      /^Gabriel$/i,
      /^Virgil$/i,
      /^Petrovi[cć]$/i,
    ],
    captainHint: /^Haaland$/i,
    preferValue: false,
  },
  {
    id: "haaland-saka-pedro-sp",
    title: "Haaland (C) · Saka + João Pedro pens/attack",
    mustIncludeHints: [
      /^Haaland$/i,
      /^Saka$/i,
      /^Jo[aã]o Pedro$/i,
      /^Tavernier$/i,
      /^Petrovi[cć]$/i,
      /^Richards$/i,
    ],
    captainHint: /^Haaland$/i,
    preferValue: true,
  },
];

function findHint(pool: Cand[], re: RegExp, pos?: Pos): Cand | null {
  const hits = pool
    .filter((c) => (pos ? c.position === pos : true))
    .filter((c) => re.test(c.web_name))
    .sort((a, b) => b.score - a.score || b.xp_horizon - a.xp_horizon);
  return hits[0] ?? null;
}

function formatPlayerLine(p: Cand, tag: string): string {
  return `• ${p.position} ${p.web_name}${tag} — ${p.team_short} £${p.price.toFixed(1)} · xP ${p.xp_horizon.toFixed(1)} · FDR ${p.team_avg_fdr.toFixed(2)} · DC ${defconLabel(p)} · SP ${setPieceLabel(p)} · ~${p.avg_expected_minutes.toFixed(0)}'`;
}

function formatSquad(
  title: string,
  evald: EvalResult,
  captain: Cand,
  vice: Cand,
  horizon: number,
  fromGw: number,
  toGw: number,
): string {
  const lines = [
    `🔒 SET & FORGET · ${title}`,
    `Horizon GW${fromGw}–${toGw} (${horizon} GWs) · £${evald.spend}m / £${SQUAD_BUILDER_BUDGET_M}m`,
    `Formation ${evald.formation} · XI xP ${evald.xiXp} · Cap xP ${evald.captainXp} · DEF FDR-comp ${evald.defComplement} · Score ${evald.totalWithCaptain}`,
    `Captain: ${captain.web_name} (locked) · Vice: ${vice.web_name}`,
    "",
    "⚽ LOCKED XI",
  ];
  for (const p of evald.xi) {
    const tag =
      p.fpl_id === captain.fpl_id
        ? " (C)"
        : p.fpl_id === vice.fpl_id
          ? " (V)"
          : "";
    lines.push(formatPlayerLine(p, tag));
  }
  lines.push("", "🪑 BENCH (auto-sub insurance)");
  for (const p of evald.bench) lines.push(formatPlayerLine(p, ""));
  return lines.join("\n");
}

async function main() {
  const horizon = parseHorizon();
  console.log(`Loading pool & projecting GW window (horizon=${horizon})…`);
  const { cands, fromGw, toGw, currentGw, fdrByTeam } = await loadPool(horizon);
  console.log(
    `Pool after gates (≥${MIN_AVG_EXPECTED_MINS}', no new-club DEF): ${cands.length} · currentGw=${currentGw}`,
  );

  const draftPool = cands.map(toDraftCand);
  const results: {
    strategy: string;
    title: string;
    text: string;
    totalWithCaptain: number;
    json: unknown;
  }[] = [];

  const pushResult = (
    strategy: string,
    title: string,
    squad: Cand[],
    captain: Cand,
    forceStartIds: Set<number> = new Set(),
  ) => {
    const evald = evaluateSquadFixed(
      squad,
      captain.fpl_id,
      fdrByTeam,
      fromGw,
      toGw,
      forceStartIds,
    );
    if (!evald) return;
    const vice =
      [...evald.xi]
        .filter((c) => c.fpl_id !== captain.fpl_id)
        .sort((a, b) => b.xp_horizon - a.xp_horizon)[0] ?? captain;
    results.push({
      strategy,
      title,
      text: formatSquad(title, evald, captain, vice, horizon, fromGw, toGw),
      totalWithCaptain: evald.totalWithCaptain,
      json: { strategy, squad, eval: evald, captain, vice },
    });
  };

  for (const strat of STRATEGIES) {
    const must: Cand[] = [];
    for (const re of strat.mustIncludeHints) {
      const hit = findHint(cands, re);
      if (hit && !must.some((m) => m.fpl_id === hit.fpl_id)) must.push(hit);
    }

    let captain =
      findHint(cands, strat.captainHint) ??
      [...cands]
        .filter(
          (c) =>
            (c.position === "MID" || c.position === "FWD") &&
            c.avg_expected_minutes >= CAPTAIN_MIN_AVG_MINS,
        )
        .sort((a, b) => b.xp_horizon - a.xp_horizon)[0];

    if (!captain) {
      console.warn(`Skip ${strat.id}: no captain`);
      continue;
    }
    if (!must.some((m) => m.fpl_id === captain!.fpl_id)) must.unshift(captain);

    let squadDraft;
    try {
      squadDraft = buildBudgetSquad(draftPool, 42, {
        budget: SQUAD_BUILDER_BUDGET_M,
        mustInclude: must.map(toDraftCand),
        preferValue: strat.preferValue,
      });
    } catch (e) {
      console.warn(`Skip ${strat.id}: ${(e as Error).message}`);
      continue;
    }
    if (squadDraft.length !== 15) continue;

    const byId = new Map(cands.map((c) => [c.fpl_id, c]));
    let squad = squadDraft
      .map((d) => byId.get(d.fpl_id))
      .filter((c): c is Cand => Boolean(c));
    if (squad.length !== 15) continue;

    const protectedIds = new Set(must.map((m) => m.fpl_id));
    squad = forceSpendUpgrades(squad, cands, SQUAD_BUILDER_BUDGET_M, protectedIds);
    squad = optimizeDefLine(
      squad,
      cands,
      fdrByTeam,
      fromGw,
      toGw,
      SQUAD_BUILDER_BUDGET_M,
      protectedIds,
    );

    if (!squad.some((c) => c.fpl_id === captain.fpl_id)) {
      const bestCap = [...squad]
        .filter(
          (c) =>
            (c.position === "MID" || c.position === "FWD") &&
            c.avg_expected_minutes >= CAPTAIN_MIN_AVG_MINS,
        )
        .sort((a, b) => b.xp_horizon - a.xp_horizon)[0];
      if (!bestCap) continue;
      captain = bestCap;
    }
    const forceStart = new Set(
      must
        .filter(
          (m) =>
            m.position === "FWD" ||
            m.position === "MID" ||
            m.position === "GKP" ||
            /^Haaland$/i.test(m.web_name) ||
            /^Richards$/i.test(m.web_name) ||
            /^Virgil$/i.test(m.web_name) ||
            /^Petrovi[cć]$/i.test(m.web_name),
        )
        .map((m) => m.fpl_id),
    );
    forceStart.add(captain.fpl_id);
    // Rodon is locked for bench insurance — do not force into XI.
    const rodon = must.find((m) => /^Rodon$/i.test(m.web_name));
    if (rodon) forceStart.delete(rodon.fpl_id);
    pushResult(strat.id, strat.title, squad, captain, forceStart);
  }

  // Greedy: set-piece + FDR scored pool, then DEF complement polish.
  {
    const squadDraft = buildBudgetSquad(draftPool, 7, {
      budget: SQUAD_BUILDER_BUDGET_M,
      preferValue: true,
    });
    const byId = new Map(cands.map((c) => [c.fpl_id, c]));
    let squad = squadDraft
      .map((d) => byId.get(d.fpl_id))
      .filter((c): c is Cand => Boolean(c));
    if (squad.length === 15) {
      squad = forceSpendUpgrades(squad, cands);
      squad = optimizeDefLine(squad, cands, fdrByTeam, fromGw, toGw);
      const captain = [...squad]
        .filter(
          (c) =>
            (c.position === "MID" || c.position === "FWD") &&
            c.avg_expected_minutes >= CAPTAIN_MIN_AVG_MINS &&
            c.prior_starts >= MIN_PRIOR_STARTS_XI,
        )
        .sort((a, b) => b.xp_horizon - a.xp_horizon)[0];
      if (captain) {
        pushResult(
          `greedy-${captain.web_name}`,
          `Greedy SP+FDR · ${captain.web_name} (C)`,
          squad,
          captain,
        );
      }
    }
  }

  results.sort((a, b) => b.totalWithCaptain - a.totalWithCaptain);

  const outDir = join(process.cwd(), "output", "set-and-forget");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "candidates.json"),
    JSON.stringify(
      {
        horizon,
        fromGw,
        toGw,
        generated_at: new Date().toISOString(),
        factors: [
          "minutes",
          "set-pieces",
          "FDR",
          "DEFCON",
          "DEF-complement",
          "xP+captain",
        ],
        excluded_new_club_def: "Senesi|Lacroix|Guéhi|Van Hecke|Mukiele",
        fwd_preference: "João Pedro > Mateta",
        top_by_score: cands.slice(0, 40).map((c) => ({
          name: c.web_name,
          pos: c.position,
          team: c.team_short,
          price: c.price,
          xp: Math.round(c.xp_horizon * 10) / 10,
          fdr: Math.round(c.team_avg_fdr * 100) / 100,
          dc90: c.defcon_per_90,
          sp: setPieceLabel(c),
          starts: c.prior_starts,
          score: Math.round(c.score * 10) / 10,
        })),
        top_defs: cands
          .filter((c) => c.position === "DEF")
          .slice(0, 20)
          .map((c) => ({
            name: c.web_name,
            team: c.team_short,
            price: c.price,
            xp: Math.round(c.xp_horizon * 10) / 10,
            fdr: Math.round(c.team_avg_fdr * 100) / 100,
            dc90: c.defcon_per_90,
            sp: setPieceLabel(c),
            starts: c.prior_starts,
            score: Math.round(c.score * 10) / 10,
          })),
        squads: results.map((r) => r.json),
      },
      null,
      2,
    ),
    "utf8",
  );

  const report = [
    "══════════════════════════════════════════",
    "  SET & FORGET CONTEST · FALEAGUE PICKS",
    `  GW${fromGw}–${toGw} · minutes + set-pieces + FDR + DEFCON`,
    "══════════════════════════════════════════",
    "",
    "Excluded: new-club DEF (Senesi/Lacroix/…) · contested GK Dubravka · Ballard/Botman XI.",
    "FWD preference: João Pedro over Mateta. DEFCON weighted for DEF/MID floors.",
    "DEF line optimized for set-piece + DEFCON + complementary FDR.",
    "",
    ...results.flatMap((r, i) => [
      `#${i + 1}`,
      r.text,
      "",
      "──────────────────────────────────────────",
      "",
    ]),
    "Top DEF pool (SP + FDR + DEFCON scored):",
    ...cands
      .filter((c) => c.position === "DEF")
      .slice(0, 15)
      .map(
        (c, i) =>
          `${String(i + 1).padStart(2)}. ${c.web_name} (${c.team_short}) £${c.price.toFixed(1)} · xP ${c.xp_horizon.toFixed(1)} · FDR ${c.team_avg_fdr.toFixed(2)} · DC ${defconLabel(c)} · SP ${setPieceLabel(c)} · ${c.prior_starts}st · score ${c.score.toFixed(1)}`,
      ),
    "",
    "Top overall pool:",
    ...cands.slice(0, 20).map(
      (c, i) =>
        `${String(i + 1).padStart(2)}. ${c.position} ${c.web_name} (${c.team_short}) £${c.price.toFixed(1)} · xP ${c.xp_horizon.toFixed(1)} · FDR ${c.team_avg_fdr.toFixed(2)} · DC ${defconLabel(c)} · SP ${setPieceLabel(c)} · score ${c.score.toFixed(1)}`,
    ),
    "",
  ].join("\n");

  writeFileSync(join(outDir, "report.txt"), report, "utf8");
  console.log(report);
  console.log(`\nWrote ${join(outDir, "report.txt")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
