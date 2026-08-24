import type { FplClassicLeague } from "@/lib/fpl";
import type {
  MiniLeagueKind,
  MiniLeagueStandingRow,
  RankMoveDir,
} from "@/lib/fpl/mini-league/types";

export function rankMove(
  rank: number | null | undefined,
  lastRank: number | null | undefined,
): { delta: number | null; dir: RankMoveDir } {
  if (rank == null || !Number.isFinite(rank)) {
    return { delta: null, dir: "new" };
  }
  if (lastRank == null || lastRank <= 0 || !Number.isFinite(lastRank)) {
    return { delta: null, dir: "new" };
  }
  const delta = lastRank - rank;
  if (delta > 0) return { delta, dir: "up" };
  if (delta < 0) return { delta, dir: "down" };
  return { delta: 0, dir: "same" };
}

export function isOverallLeague(league: Pick<FplClassicLeague, "name" | "league_type">): boolean {
  const name = (league.name ?? "").trim();
  if (/^(overall|总体)/i.test(name)) return true;
  return false;
}

export function classifyClassicLeague(
  league: Pick<FplClassicLeague, "name" | "league_type">,
): MiniLeagueKind {
  if (isOverallLeague(league)) return "overall";
  if ((league.league_type ?? "").toLowerCase() === "x") return "mini";
  return "public";
}

export function pickRivalSample<T extends { entry: number; rank: number }>(
  standings: T[],
  entryId: number,
  opts?: { maxAbove?: number; maxBelow?: number; allIfAtMost?: number },
): T[] {
  const maxAbove = opts?.maxAbove ?? 10;
  const maxBelow = opts?.maxBelow ?? 3;
  const allIfAtMost = opts?.allIfAtMost ?? 40;
  if (standings.length <= allIfAtMost) return standings;

  const youIdx = standings.findIndex((row) => row.entry === entryId);
  if (youIdx < 0) return standings.slice(0, Math.min(8, standings.length));

  const start = Math.max(0, youIdx - maxAbove);
  const end = Math.min(standings.length, youIdx + 1 + maxBelow);
  const slice = standings.slice(start, end);
  if (start > 0 && standings[0] && !slice.some((row) => row.entry === standings[0]!.entry)) {
    return [standings[0], ...slice];
  }
  return slice;
}

export function pointsToCatch(
  youTotal: number | null | undefined,
  rivalTotal: number | null | undefined,
): number | null {
  if (youTotal == null || rivalTotal == null) return null;
  const gap = rivalTotal - youTotal;
  if (gap <= 0) return 0;
  return gap + 1;
}

export function sortMovers(rows: MiniLeagueStandingRow[]): MiniLeagueStandingRow[] {
  return [...rows]
    .filter((row) => row.rankDir === "up" || row.rankDir === "down")
    .sort((a, b) => Math.abs(b.rankDelta ?? 0) - Math.abs(a.rankDelta ?? 0));
}

export const STANDINGS_PAGE_SIZE = 50;

export function standingsPageForRank(
  rank: number | null | undefined,
  pageSize = STANDINGS_PAGE_SIZE,
): number {
  if (rank == null || !Number.isFinite(rank) || rank < 1) return 1;
  return Math.max(1, Math.ceil(rank / pageSize));
}

export type ChipKind = "wildcard" | "freehit" | "bboost" | "3xc";

export type ChipSlotStatus = {
  used: boolean;
  event: number | null;
};

export type ChipSlots = {
  wc1: ChipSlotStatus;
  wc2: ChipSlotStatus;
  fh1: ChipSlotStatus;
  fh2: ChipSlotStatus;
  bb1: ChipSlotStatus;
  bb2: ChipSlotStatus;
  tc1: ChipSlotStatus;
  tc2: ChipSlotStatus;
};

function chipNameKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/[\s_-]/g, "");
}

/** Map `/entry/{id}/history/` chip names to a canonical bucket. */
export function classifyChipName(name: string): ChipKind | null {
  const id = chipNameKey(name);
  if (id === "wildcard" || id === "wc") return "wildcard";
  if (id === "freehit" || id === "ff") return "freehit";
  if (id === "bboost" || id === "benchboost" || (id.includes("bench") && id.includes("boost"))) {
    return "bboost";
  }
  if (id === "3xc" || id === "triplecaptain" || id.includes("triplecaptain")) {
    return "3xc";
  }
  return null;
}

function chipPhase(kind: ChipKind, event: number): 1 | 2 | null {
  if (!Number.isFinite(event) || event < 1 || event > 38) return null;
  if (kind === "wildcard" || kind === "freehit") {
    if (event >= 2 && event <= 19) return 1;
    if (event >= 20 && event <= 38) return 2;
    return null;
  }
  if (event >= 1 && event <= 19) return 1;
  if (event >= 20 && event <= 38) return 2;
  return null;
}

function emptySlot(): ChipSlotStatus {
  return { used: false, event: null };
}

export function emptyChipSlots(): ChipSlots {
  return {
    wc1: emptySlot(),
    wc2: emptySlot(),
    fh1: emptySlot(),
    fh2: emptySlot(),
    bb1: emptySlot(),
    bb2: emptySlot(),
    tc1: emptySlot(),
    tc2: emptySlot(),
  };
}

export function chipSlotsFromUsed(
  chipsUsed: { name: string; event?: number }[],
): ChipSlots {
  const slots = emptyChipSlots();
  for (const chip of chipsUsed) {
    const kind = classifyChipName(chip.name);
    if (!kind) continue;
    const phase = chipPhase(kind, chip.event ?? NaN);
    if (phase == null) continue;
    const event = Number(chip.event);
    const status: ChipSlotStatus = {
      used: true,
      event: Number.isFinite(event) ? event : null,
    };
    if (kind === "wildcard") {
      if (phase === 1) slots.wc1 = status;
      else slots.wc2 = status;
    } else if (kind === "freehit") {
      if (phase === 1) slots.fh1 = status;
      else slots.fh2 = status;
    } else if (kind === "bboost") {
      if (phase === 1) slots.bb1 = status;
      else slots.bb2 = status;
    } else if (phase === 1) slots.tc1 = status;
    else slots.tc2 = status;
  }
  return slots;
}

export function remainingFromSlots(slots: ChipSlots): {
  wildcardsRemaining: number;
  freeHitsRemaining: number;
  benchBoostsRemaining: number;
  tripleCaptainsRemaining: number;
} {
  return {
    wildcardsRemaining: (slots.wc1.used ? 0 : 1) + (slots.wc2.used ? 0 : 1),
    freeHitsRemaining: (slots.fh1.used ? 0 : 1) + (slots.fh2.used ? 0 : 1),
    benchBoostsRemaining: (slots.bb1.used ? 0 : 1) + (slots.bb2.used ? 0 : 1),
    tripleCaptainsRemaining: (slots.tc1.used ? 0 : 1) + (slots.tc2.used ? 0 : 1),
  };
}

export type RankChartRole = "you" | "leader" | "next" | "nearby";

export function rankChartRole(
  row: { entry: number; rank: number },
  youEntryId: number,
  leaderEntry: number | null,
  nextEntry: number | null,
): RankChartRole {
  if (row.entry === youEntryId) return "you";
  if (leaderEntry != null && row.entry === leaderEntry) return "leader";
  if (nextEntry != null && row.entry === nextEntry) return "next";
  return "nearby";
}

/** How different a 15-man squad is vs yours: 0% identical, 100% no shared players. */
export function squadDiffPct(youIds: number[], themIds: number[]): number | null {
  const you = [...new Set(youIds.filter((id) => Number.isFinite(id) && id > 0))];
  const them = [...new Set(themIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!you.length || !them.length) return null;
  const youSet = new Set(you);
  let shared = 0;
  for (const id of them) {
    if (youSet.has(id)) shared += 1;
  }
  const denom = 15;
  return Math.round((100 * (denom - Math.min(shared, denom))) / denom);
}
