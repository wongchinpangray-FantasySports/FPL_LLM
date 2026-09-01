/**
 * Squad diagnosis + paired out→in transfer suggestions (bank / FT aware).
 * Reuses shared xP projections and the same availability rules as planner swap-recs.
 */

import { getServerSupabase } from "@/lib/supabase";
import {
  nextFixtureForPlayers,
  projectPlayers,
  type NextFixtureOpponent,
  type PlayerProjection,
} from "@/lib/xp";
import { resolvePlannerProjectionWindow } from "@/lib/planner/projection-window";
import {
  fetchTeamForUi,
  picksForPlanning,
  type FplSquadPick,
} from "@/lib/tools/team";

export type DiagnosisKind =
  | "injured"
  | "doubtful"
  | "suspended"
  | "unavailable"
  | "low_xp"
  | "low_form"
  | "tough_fixture"
  | "blank";

export type SquadPlayerSignal = {
  form: number | null;
  xp_horizon: number | null;
  severity: "alert" | "watch" | "info" | "none";
  kinds: DiagnosisKind[];
  notes: string[];
};

export type DiagnosisItem = {
  fpl_id: number;
  web_name: string;
  team: string;
  position: string | null;
  is_starter: boolean;
  kind: DiagnosisKind;
  note: string;
  severity: "alert" | "watch" | "info";
  xp_horizon: number | null;
  next: NextFixtureOpponent | null;
};

export type TransferPlayerCard = {
  fpl_id: number;
  web_name: string;
  team: string;
  team_id: number | null;
  position: string | null;
  price: number | null;
  xp_horizon: number;
  xp_next_gw: number;
  next: NextFixtureOpponent | null;
};

export type TransferSuggestion = {
  out: TransferPlayerCard;
  in: TransferPlayerCard;
  xp_delta: number;
  spend_m: number;
  bank_after: number;
  hit_cost: number;
  xp_delta_net: number;
  out_reasons: DiagnosisKind[];
  in_reason: "higher_xp" | "better_fdr" | "cover_risk";
};

export type DiagnoseResult = {
  entry_id: number;
  entry_name: string;
  gw: number;
  from_gw: number;
  to_gw: number;
  horizon: number;
  bank: number;
  free_transfers: number;
  health_status: "good" | "watch" | "alert";
  diagnosis: DiagnosisItem[];
  /** Per-player attention for pitch markers (keys are fpl_id strings). */
  signals_by_fpl_id: Record<string, SquadPlayerSignal>;
  suggestions: TransferSuggestion[];
};

type StaticMeta = {
  fpl_id: number;
  web_name: string | null;
  status: string | null;
  chance_of_playing: number | null;
  news: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
  minutes: number | null;
  form: number | null;
  total_points: number | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isAvailable(status: string | null, chance: number | null): boolean {
  const s = (status ?? "a").toLowerCase();
  if (s === "u" || s === "n" || s === "s") return false;
  if (chance != null && chance < 50) return false;
  return true;
}

function xpNextGw(p: PlayerProjection, gw: number): number {
  return Math.round(
    p.fixtures.filter((f) => f.gw === gw).reduce((s, f) => s + f.xp_total, 0) *
      100,
  ) / 100;
}

function toCard(
  p: PlayerProjection,
  next: NextFixtureOpponent | null,
  fromGw: number,
): TransferPlayerCard {
  return {
    fpl_id: p.fpl_id,
    web_name: p.web_name ?? `#${p.fpl_id}`,
    team: p.team ?? "—",
    team_id: p.team_id,
    position: p.position,
    price: p.price,
    xp_horizon: Math.round(p.xp_total * 100) / 100,
    xp_next_gw: xpNextGw(p, fromGw),
    next,
  };
}

async function loadStaticMeta(ids: number[]): Promise<Map<number, StaticMeta>> {
  const map = new Map<number, StaticMeta>();
  if (!ids.length) return map;
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("players_static")
    .select(
      "fpl_id,web_name,status,chance_of_playing,news,team,team_id,position,base_price,minutes,form,total_points",
    )
    .in("fpl_id", ids);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    map.set(Number(r.fpl_id), r as StaticMeta);
  }
  return map;
}

const SEVERITY_RANK = { alert: 0, watch: 1, info: 2, none: 3 } as const;

function maxSeverity(
  a: SquadPlayerSignal["severity"],
  b: SquadPlayerSignal["severity"],
): SquadPlayerSignal["severity"] {
  if (a === "none") return b;
  if (b === "none") return a;
  return SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b;
}

export function buildSquadSignals(
  picks: FplSquadPick[],
  diagnosis: DiagnosisItem[],
  metaById: Map<number, StaticMeta>,
): Record<number, SquadPlayerSignal> {
  const out = new Map<number, SquadPlayerSignal>();
  for (const pick of picks) {
    const meta = metaById.get(pick.fpl_id);
    out.set(pick.fpl_id, {
      form: num(meta?.form),
      xp_horizon: null,
      severity: "none",
      kinds: [],
      notes: [],
    });
  }
  for (const d of diagnosis) {
    const sig = out.get(d.fpl_id);
    if (!sig) continue;
    if (d.xp_horizon != null) sig.xp_horizon = d.xp_horizon;
    if (!sig.kinds.includes(d.kind)) sig.kinds.push(d.kind);
    if (d.note && !sig.notes.includes(d.note)) sig.notes.push(d.note);
    sig.severity = maxSeverity(sig.severity, d.severity);
  }
  return Object.fromEntries(out);
}

function buildDiagnosis(
  picks: FplSquadPick[],
  metaById: Map<number, StaticMeta>,
  projections: Map<number, PlayerProjection>,
  nextById: Map<number, NextFixtureOpponent | null>,
  fromGw: number,
): { status: "good" | "watch" | "alert"; items: DiagnosisItem[] } {
  const items: DiagnosisItem[] = [];
  const starters = picks.filter((p) => p.is_starter);
  const starterXp = starters
    .map((p) => projections.get(p.fpl_id)?.xp_total ?? 0)
    .filter((n) => n > 0);
  const medianXp =
    starterXp.length > 0
      ? [...starterXp].sort((a, b) => a - b)[Math.floor(starterXp.length / 2)]!
      : 0;

  for (const pick of picks) {
    const meta = metaById.get(pick.fpl_id);
    const proj = projections.get(pick.fpl_id);
    const next = nextById.get(pick.fpl_id) ?? null;
    const name =
      meta?.web_name?.trim() ||
      pick.web_name?.trim() ||
      proj?.web_name?.trim() ||
      `#${pick.fpl_id}`;
    const team = meta?.team?.trim() || pick.team?.trim() || proj?.team || "—";
    const position = meta?.position ?? pick.position ?? proj?.position ?? null;
    const status = (meta?.status ?? "a").toLowerCase();
    const news = String(meta?.news ?? "").trim();
    const chance =
      typeof meta?.chance_of_playing === "number"
        ? meta.chance_of_playing
        : null;
    const base = {
      fpl_id: pick.fpl_id,
      web_name: name,
      team,
      position,
      is_starter: pick.is_starter,
      xp_horizon: proj ? Math.round(proj.xp_total * 100) / 100 : null,
      next,
    };

    if (status === "i") {
      items.push({
        ...base,
        kind: "injured",
        note: chance != null ? `${chance}%` : news || "injured",
        severity: "alert",
      });
    } else if (status === "d") {
      items.push({
        ...base,
        kind: "doubtful",
        note: chance != null ? `${chance}%` : news || "doubtful",
        severity: "watch",
      });
    } else if (status === "s") {
      items.push({
        ...base,
        kind: "suspended",
        note: news || "suspended",
        severity: "alert",
      });
    } else if (status === "u" || status === "n") {
      items.push({
        ...base,
        kind: "unavailable",
        note: news || "unavailable",
        severity: "alert",
      });
    }

    if (pick.is_starter && next == null) {
      items.push({
        ...base,
        kind: "blank",
        note: `No fixture GW${fromGw}`,
        severity: "watch",
      });
    } else if (
      pick.is_starter &&
      next?.fdr != null &&
      next.fdr >= 4
    ) {
      items.push({
        ...base,
        kind: "tough_fixture",
        note: `${next.opp_short} (${next.home ? "H" : "A"}) FDR ${next.fdr}`,
        severity: "info",
      });
    }

    if (
      pick.is_starter &&
      proj &&
      medianXp > 0 &&
      proj.xp_total < medianXp * 0.65 &&
      status === "a"
    ) {
      items.push({
        ...base,
        kind: "low_xp",
        note: `xP ${proj.xp_total.toFixed(1)} vs squad median ${medianXp.toFixed(1)}`,
        severity: "watch",
      });
    }

    const formVal = num(meta?.form);
    if (pick.is_starter && status === "a" && formVal != null && formVal < 3) {
      items.push({
        ...base,
        kind: "low_form",
        note: `Form ${formVal.toFixed(1)}`,
        severity: "watch",
      });
    }
  }

  const severityRank = { alert: 0, watch: 1, info: 2 } as const;
  items.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      Number(b.is_starter) - Number(a.is_starter),
  );

  let health: "good" | "watch" | "alert" = "good";
  if (items.some((i) => i.severity === "alert")) health = "alert";
  else if (items.some((i) => i.severity === "watch")) health = "watch";

  return { status: health, items };
}

async function loadCandidatePool(
  excludeIds: Set<number>,
  positions: string[],
): Promise<StaticMeta[]> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("players_static")
    .select(
      "fpl_id,web_name,status,chance_of_playing,news,team,team_id,position,base_price,minutes,form,total_points",
    )
    .in("position", positions)
    .not("team_id", "is", null)
    .gte("minutes", 90)
    .lte("base_price", 15);

  if (error) throw new Error(error.message);

  const scored = ((data ?? []) as StaticMeta[])
    .filter((r) => {
      if (excludeIds.has(r.fpl_id)) return false;
      return isAvailable(
        r.status,
        typeof r.chance_of_playing === "number" ? r.chance_of_playing : null,
      );
    })
    .map((r) => ({
      row: r,
      score:
        (num(r.form) ?? 0) * 12 +
        (num(r.total_points) ?? 0) +
        (num(r.minutes) ?? 0) / 90,
    }))
    .sort((a, b) => b.score - a.score);

  // Cap ~15 per position → ~60 total
  const perPos = new Map<string, number>();
  const out: StaticMeta[] = [];
  for (const { row } of scored) {
    const pos = (row.position ?? "").toUpperCase();
    const n = perPos.get(pos) ?? 0;
    if (n >= 15) continue;
    perPos.set(pos, n + 1);
    out.push(row);
  }
  return out;
}

function outReasonsFor(
  fplId: number,
  diagnosis: DiagnosisItem[],
): DiagnosisKind[] {
  const kinds = diagnosis
    .filter((d) => d.fpl_id === fplId)
    .map((d) => d.kind);
  return [...new Set(kinds)];
}

export async function diagnoseSquadTransfers(opts: {
  entryId: number;
  horizon?: number;
  forceRefresh?: boolean;
}): Promise<DiagnoseResult> {
  const entryId = opts.entryId;
  const window = await resolvePlannerProjectionWindow(opts.horizon ?? 3);
  const { currentGw, fromGw, toGw, horizon } = window;

  const team = await fetchTeamForUi(entryId, opts.forceRefresh ?? false);
  const picks = picksForPlanning(team);
  if (picks.length === 0) {
    throw new Error("No squad picks available for this entry.");
  }

  const ownedIds = picks.map((p) => p.fpl_id);
  const ownedSet = new Set(ownedIds);
  const positions = [
    ...new Set(
      picks
        .map((p) => (p.position ?? "").toUpperCase())
        .filter((p) => ["GKP", "DEF", "MID", "FWD"].includes(p)),
    ),
  ];

  const [squadMeta, candidates] = await Promise.all([
    loadStaticMeta(ownedIds),
    loadCandidatePool(ownedSet, positions.length ? positions : ["DEF", "MID", "FWD"]),
  ]);

  const candidateIds = candidates.map((c) => c.fpl_id);
  const allIds = [...new Set([...ownedIds, ...candidateIds])];

  const [projections, nextById] = await Promise.all([
    projectPlayers(allIds, {
      currentGw,
      fromGw,
      toGw,
    }),
    nextFixtureForPlayers(allIds, { minGw: fromGw }),
  ]);

  const { status: health_status, items: diagnosis } = buildDiagnosis(
    picks,
    squadMeta,
    projections,
    nextById,
    fromGw,
  );
  const signals_by_fpl_id = Object.fromEntries(
    Object.entries(buildSquadSignals(picks, diagnosis, squadMeta)).map(
      ([k, v]) => [k, v],
    ),
  );

  const bank = team.bank;
  const freeTransfers = team.free_transfers ?? 1;
  const hitCost = freeTransfers >= 1 ? 0 : 4;

  const clubCount = new Map<number, number>();
  for (const id of ownedIds) {
    const tid = projections.get(id)?.team_id ?? squadMeta.get(id)?.team_id;
    if (tid != null) clubCount.set(tid, (clubCount.get(tid) ?? 0) + 1);
  }

  // Prefer outs flagged in diagnosis, then lowest xP starters, then bench.
  const outPriority = new Map<number, number>();
  for (const d of diagnosis) {
    const base =
      d.severity === "alert" ? 100 : d.severity === "watch" ? 60 : 30;
    outPriority.set(d.fpl_id, Math.max(outPriority.get(d.fpl_id) ?? 0, base));
  }

  const ownedProjs = ownedIds
    .map((id) => projections.get(id))
    .filter((p): p is PlayerProjection => !!p);

  type Pair = {
    out: PlayerProjection;
    inn: PlayerProjection;
    delta: number;
    spend: number;
  };

  const bestByOut = new Map<number, Pair>();

  for (const outP of ownedProjs) {
    const outPrice = outP.price ?? 0;
    const budget = outPrice + bank;
    let best: Pair | null = null;

    for (const cand of projections.values()) {
      if (ownedSet.has(cand.fpl_id)) continue;
      if (cand.position !== outP.position) continue;
      if ((cand.price ?? Infinity) > budget) continue;

      if (cand.team_id != null) {
        const after =
          (clubCount.get(cand.team_id) ?? 0) +
          1 -
          (outP.team_id === cand.team_id ? 1 : 0);
        if (after > 3) continue;
      }

      const delta = cand.xp_total - outP.xp_total;
      if (delta <= 0.05) continue;

      const spend = (cand.price ?? 0) - outPrice;
      if (!best || delta > best.delta) {
        best = { out: outP, inn: cand, delta, spend };
      }
    }

    if (best) bestByOut.set(outP.fpl_id, best);
  }

  const rankedPairs = [...bestByOut.values()].sort((a, b) => {
    const pa = outPriority.get(a.out.fpl_id) ?? 0;
    const pb = outPriority.get(b.out.fpl_id) ?? 0;
    if (pb !== pa) return pb - pa;
    return b.delta - a.delta;
  });

  // Diversify outs — one suggestion per out player, top 5
  const suggestions: TransferSuggestion[] = [];
  const usedIns = new Set<number>();
  for (const pair of rankedPairs) {
    if (suggestions.length >= 5) break;
    if (usedIns.has(pair.inn.fpl_id)) continue;
    usedIns.add(pair.inn.fpl_id);

    const reasons = outReasonsFor(pair.out.fpl_id, diagnosis);
    const outNext = nextById.get(pair.out.fpl_id) ?? null;
    const inNext = nextById.get(pair.inn.fpl_id) ?? null;
    let in_reason: TransferSuggestion["in_reason"] = "higher_xp";
    if (reasons.some((r) => r === "injured" || r === "doubtful" || r === "suspended")) {
      in_reason = "cover_risk";
    } else if (
      outNext?.fdr != null &&
      inNext?.fdr != null &&
      inNext.fdr < outNext.fdr
    ) {
      in_reason = "better_fdr";
    }

    suggestions.push({
      out: toCard(pair.out, outNext, fromGw),
      in: toCard(pair.inn, inNext, fromGw),
      xp_delta: Math.round(pair.delta * 100) / 100,
      spend_m: Math.round(pair.spend * 10) / 10,
      bank_after: Math.round((bank - pair.spend) * 10) / 10,
      hit_cost: hitCost,
      xp_delta_net: Math.round((pair.delta - hitCost) * 100) / 100,
      out_reasons: reasons.length ? reasons : ["low_xp"],
      in_reason,
    });
  }

  return {
    entry_id: entryId,
    entry_name: team.entry.name,
    gw: currentGw,
    from_gw: fromGw,
    to_gw: toGw,
    horizon,
    bank,
    free_transfers: freeTransfers,
    health_status,
    diagnosis: diagnosis.slice(0, 12),
    signals_by_fpl_id,
    suggestions,
  };
}
