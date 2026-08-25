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

export const RIVAL_WINDOW_AHEAD = 10;
export const RIVAL_WINDOW_BEHIND = 10;

export function clampRivalWindow(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(25, Math.max(0, Math.round(n)));
}

/**
 * FPL standings pages needed so `ahead` ranks above and `behind` below `rank`
 * are present. Never walks the full 10k table.
 */
export function standingsPagesForWindow(
  rank: number | null | undefined,
  opts?: { ahead?: number; behind?: number; pageSize?: number },
): number[] {
  const pageSize = Math.max(1, opts?.pageSize ?? STANDINGS_PAGE_SIZE);
  const ahead = clampRivalWindow(opts?.ahead, RIVAL_WINDOW_AHEAD);
  const behind = clampRivalWindow(opts?.behind, RIVAL_WINDOW_BEHIND);
  const yourPage = standingsPageForRank(rank, pageSize);
  if (rank == null || !Number.isFinite(rank) || rank < 1) return [yourPage];
  const pos = ((Math.floor(rank) - 1) % pageSize) + 1;
  const pages = new Set<number>([yourPage]);
  if (pos <= ahead && yourPage > 1) pages.add(yourPage - 1);
  if (pos + behind > pageSize) pages.add(yourPage + 1);
  return [...pages].sort((a, b) => a - b);
}

/**
 * Managers to plot in tools: you, up to 10 immediately above, 10 immediately below
 * in FPL table order. Do not sort by rank — tied ranks would scramble neighbors.
 * Does not inject overall #1, and does not fall back to the top of the wrong page.
 */
export function pickRivalSample<T extends { entry: number; rank: number }>(
  standings: T[],
  entryId: number,
  opts?: { ahead?: number; behind?: number; allIfAtMost?: number; maxTotal?: number },
): T[] {
  const ahead = clampRivalWindow(opts?.ahead, RIVAL_WINDOW_AHEAD);
  const behind = clampRivalWindow(opts?.behind, RIVAL_WINDOW_BEHIND);
  const windowSize = ahead + behind + 1;
  const allIfAtMost = opts?.allIfAtMost ?? windowSize;
  const youIdx = standings.findIndex((row) => row.entry === entryId);
  if (youIdx < 0) return [];
  if (standings.length <= allIfAtMost) return [...standings];

  const from = Math.max(0, youIdx - ahead);
  const to = Math.min(standings.length, youIdx + 1 + behind);
  return standings.slice(from, to);
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
export const STANDINGS_SCAN_BATCH = 4;
export const STANDINGS_SCAN_MAX_PAGES = 24;

/**
 * Hint page from `entry_rank`. FPL rank is a competition rank with ties, so the
 * actual row can sit many pages later (Chelsea #1560 was on page 38, not 32).
 */
export function standingsPageForRank(
  rank: number | null | undefined,
  pageSize = STANDINGS_PAGE_SIZE,
): number {
  if (rank == null || !Number.isFinite(rank) || rank < 1) return 1;
  return Math.max(1, Math.ceil(rank / pageSize));
}

export function resolveYourStandingsPage(
  locatedPage: number | null | undefined,
  rank: number | null | undefined,
): number {
  if (locatedPage != null && Number.isFinite(locatedPage) && locatedPage >= 1) {
    return Math.floor(locatedPage);
  }
  return standingsPageForRank(rank);
}

/** Next FPL `page_standings` values to fetch while walking forward from `hint`. */
export function nextStandingsScanPages(
  collectedPages: number[],
  hint: number,
  batch = STANDINGS_SCAN_BATCH,
): number[] {
  const safeHint = Math.max(1, Math.floor(hint) || 1);
  const size = Math.max(1, Math.floor(batch) || STANDINGS_SCAN_BATCH);
  const atOrAfterHint = collectedPages.filter((page) => page >= safeHint);
  const lastPage = atOrAfterHint.length ? Math.max(...atOrAfterHint) : safeHint - 1;
  return Array.from({ length: size }, (_, i) => lastPage + i + 1).filter((page) => page >= 1);
}

export function shouldContinueStandingsScan(opts: {
  found: boolean;
  scanned: number;
  maxPages?: number;
  frontierLoaded: boolean;
  frontierHasNext: boolean | undefined;
  lastRank: number | null | undefined;
  youRank: number | null | undefined;
}): boolean {
  if (opts.found) return false;
  if (opts.scanned >= (opts.maxPages ?? STANDINGS_SCAN_MAX_PAGES)) return false;
  if (opts.frontierLoaded) {
    if (!opts.frontierHasNext) return false;
    const lastRank = Number(opts.lastRank);
    const youRank = opts.youRank;
    if (
      youRank != null &&
      Number.isFinite(youRank) &&
      youRank > 0 &&
      Number.isFinite(lastRank) &&
      lastRank > youRank
    ) {
      return false;
    }
  }
  return true;
}

/** Pages needed so 10-above / 10-below of a located row are present. */
export function neighborStandingsPages(
  page: number,
  indexOnPage: number,
  pageLength: number,
): number[] {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const pages = new Set<number>([safePage]);
  if (indexOnPage < RIVAL_WINDOW_AHEAD && safePage > 1) pages.add(safePage - 1);
  if (indexOnPage + RIVAL_WINDOW_BEHIND >= Math.max(0, pageLength)) {
    pages.add(safePage + 1);
  }
  return [...pages].sort((a, b) => a - b);
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

/** Always 5 ticks so early-season rank charts are not stretched across two points. */
export const RANK_CHART_SPAN = 5;

export function rankChartGwWindow(
  currentGw: number,
  span = RANK_CHART_SPAN,
): number[] {
  const gw = Math.max(1, Math.min(38, Math.floor(Number(currentGw)) || 1));
  const n = Math.max(2, Math.min(8, Math.floor(span) || RANK_CHART_SPAN));
  const from = gw < n ? 1 : gw - n + 1;
  const gws: number[] = [];
  for (let i = 0; i < n; i++) {
    const event = from + i;
    if (event >= 1 && event <= 38) gws.push(event);
  }
  while (gws.length < n && (gws[0] ?? 1) > 1) {
    gws.unshift((gws[0] ?? 1) - 1);
  }
  return gws;
}

export type HistoryGwTotals = {
  event: number;
  points: number;
  total: number;
  overallRank: number | null;
};

/** Rank managers against each other from season totals at each GW (sample only). */
export function reconstructSampleRanks(
  histories: Map<number, HistoryGwTotals[]>,
  gws: number[],
): Map<number, Map<number, number>> {
  const byEntry = new Map<number, Map<number, number>>();
  for (const event of gws) {
    const rows: Array<{ entry: number; total: number }> = [];
    for (const [entry, pts] of histories) {
      const hit = pts.find((p) => p.event === event);
      if (hit && Number.isFinite(hit.total)) {
        rows.push({ entry, total: hit.total });
      }
    }
    rows.sort((a, b) => b.total - a.total || a.entry - b.entry);
    rows.forEach((row, i) => {
      let map = byEntry.get(row.entry);
      if (!map) {
        map = new Map();
        byEntry.set(row.entry, map);
      }
      map.set(event, i + 1);
    });
  }
  return byEntry;
}

export type GwSwingRow = {
  event: number;
  youPoints: number | null;
  rivalPoints: number | null;
  delta: number | null;
};

export function gwSwingRows(
  you: HistoryGwTotals[],
  rival: HistoryGwTotals[],
  gws: number[],
): GwSwingRow[] {
  const youBy = new Map(you.map((r) => [r.event, r]));
  const themBy = new Map(rival.map((r) => [r.event, r]));
  return gws.map((event) => {
    const yp = youBy.get(event)?.points;
    const tp = themBy.get(event)?.points;
    const youPoints = yp != null && Number.isFinite(yp) ? yp : null;
    const rivalPoints = tp != null && Number.isFinite(tp) ? tp : null;
    const delta =
      youPoints != null && rivalPoints != null ? youPoints - rivalPoints : null;
    return { event, youPoints, rivalPoints, delta };
  });
}

export function swingTally(rows: GwSwingRow[]): {
  youWon: number;
  theyWon: number;
  draws: number;
} {
  let youWon = 0;
  let theyWon = 0;
  let draws = 0;
  for (const row of rows) {
    if (row.delta == null) continue;
    if (row.delta > 0) youWon += 1;
    else if (row.delta < 0) theyWon += 1;
    else draws += 1;
  }
  return { youWon, theyWon, draws };
}
