import {
  fplGet,
  type FplEntry,
  type FplHistoryResponse,
  type FplPicksResponse,
} from "@/lib/fpl";
import { getServerSupabase } from "@/lib/supabase";
import {
  loadDoubleGameweekKeys,
  loadFixturesWindow,
  loadPlayers,
  nextFixtureForPlayers,
  projectPlayers,
  resolveCurrentGw,
} from "@/lib/xp";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { getFplBootstrapStatic } from "@/lib/fpl/bootstrap-cache";
import {
  chipSlotsFromUsed,
  classifyChipName,
  classifyClassicLeague,
  emptyChipSlots,
  gwSwingRows,
  neighborStandingsPages,
  nextStandingsScanPages,
  fixtureWindowStart,
  overlayChipSlots,
  pickRivalSample,
  pickSquadDiffEntries,
  pointsToCatch,
  publishedPicksGw,
  rankChartGwWindow,
  rankChartRole,
  rankMove,
  reconstructSampleRanks,
  shouldContinueStandingsScan,
  sortMovers,
  squadDiffPct,
  STANDINGS_PAGE_SIZE,
  STANDINGS_SCAN_BATCH,
  STANDINGS_SCAN_MAX_PAGES,
  standingsPageForRank,
  swingTally,
  type HistoryGwTotals,
} from "@/lib/fpl/mini-league/math";
import type {
  MiniLeagueAnalysis,
  MiniLeagueBeatRival,
  MiniLeagueBeatSuggestion,
  MiniLeagueChipRow,
  MiniLeagueChipSlots,
  MiniLeagueFixtureBlank,
  MiniLeagueFixtureClubShare,
  MiniLeagueFixtureOverlap,
  MiniLeagueFixtureRun,
  MiniLeagueFixtureSameOpp,
  MiniLeagueGwSwing,
  MiniLeagueFormat,
  MiniLeagueH2hLean,
  MiniLeagueH2hPayload,
  MiniLeagueH2hSide,
  MiniLeagueHealthFlag,
  MiniLeagueIndex,
  MiniLeagueLiveManager,
  MiniLeagueLivePayload,
  MiniLeagueLiveStatus,
  MiniLeagueManagerHistory,
  MiniLeagueManagerMove,
  MiniLeagueManagerSquad,
  MiniLeagueMoveBoardRow,
  MiniLeagueMovesPayload,
  MiniLeagueOwnedPlayer,
  MiniLeagueOverallSeries,
  MiniLeaguePlayerRef,
  MiniLeagueRankChart,
  MiniLeagueRankChartRole,
  MiniLeagueRankSeries,
  MiniLeagueRivalCompare,
  MiniLeagueSellIdea,
  MiniLeagueSquadPick,
  MiniLeagueStandingRow,
  MiniLeagueStandingsPage,
  MiniLeagueSummary,
  MiniLeagueToolsPayload,
  MiniLeagueTransferIdea,
} from "@/lib/fpl/mini-league/types";

const PICKS_CONCURRENCY = 6;
const HISTORY_CONCURRENCY = 3;
const TEMPLATE_PCT = 0.4;
const TEMPLATE_MIN_OWNERS = 2;
const MEMO_TTL_MS = 45_000;

type MiniLeagueGws = {
  current: number;
  next: number;
  picksGw: number;
  fixtureGw: number;
};

type HistoryPack = {
  entry: number;
  current: FplHistoryResponse["current"];
  chips: FplHistoryResponse["chips"];
};

type MemoEntry<T> = { at: number; value: T };

const windowCache = new Map<string, MemoEntry<LeagueWindow>>();
const windowInflight = new Map<string, Promise<LeagueWindow>>();
const picksCache = new Map<string, MemoEntry<FplPicksResponse | null>>();
const picksInflight = new Map<string, Promise<FplPicksResponse | null>>();
const historyCache = new Map<string, MemoEntry<HistoryPack | null>>();
const historyInflight = new Map<string, Promise<HistoryPack | null>>();

function memoGet<T>(map: Map<string, MemoEntry<T>>, key: string): T | undefined {
  const hit = map.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > MEMO_TTL_MS) {
    map.delete(key);
    return undefined;
  }
  return hit.value;
}

async function resolveGwFromBootstrap(): Promise<{ current: number; next: number }> {
  const boot = await getFplBootstrapStatic();
  const events = boot.events ?? [];
  const cur = events.find((e) => e.is_current);
  const nxt = events.find((e) => e.is_next);
  const current = Number(cur?.id) || Number(nxt?.id) || 1;
  const next = Number(nxt?.id) || current;
  return { current, next };
}

/** Prefer official bootstrap so Mini League does not follow a stale `gameweeks` row. */
async function resolveGw(): Promise<{ current: number; next: number }> {
  try {
    return await resolveGwFromBootstrap();
  } catch {
    try {
      return await resolveCurrentGw();
    } catch {
      return { current: 1, next: 1 };
    }
  }
}

async function resolveMiniLeagueGws(): Promise<MiniLeagueGws> {
  await getFplBootstrapStatic().catch(() => null);
  const { current, next } = await resolveGw();
  let currentFinished = false;
  let nextIsCurrent = false;
  try {
    const boot = await getFplBootstrapStatic();
    const cur = (boot.events ?? []).find((e) => Number(e.id) === current);
    const nxt = (boot.events ?? []).find((e) => Number(e.id) === next);
    currentFinished = Boolean(cur?.finished);
    nextIsCurrent = Boolean(nxt?.is_current);
  } catch {
    /* publishedPicksGw falls back to `current` */
  }
  const picksGw = publishedPicksGw({ current, next, currentFinished, nextIsCurrent });
  const fixtureGw = fixtureWindowStart({ current, next, currentFinished });
  return {
    current: current || 1,
    next: next || current || 1,
    picksGw,
    fixtureGw,
  };
}

type ClassicStandingsApi = {
  league?: {
    id?: number;
    name?: string;
    league_type?: string;
    scoring?: string;
    start_event?: number;
    closed?: boolean;
  };
  standings?: {
    has_next?: boolean;
    page?: number;
    results?: Array<{
      id?: number;
      event_total?: number;
      player_name?: string;
      rank?: number;
      last_rank?: number;
      total?: number;
      entry?: number;
      entry_name?: string;
      points_for?: number;
    }>;
  };
};

type PlayerMeta = {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
  status: string | null;
  chance_of_playing: number | null;
  news: string | null;
};

const POS_BY_TYPE = ["", "GKP", "DEF", "MID", "FWD"] as const;

async function loadMetaFromBootstrap(ids: number[]): Promise<Map<number, PlayerMeta>> {
  const want = new Set(ids.filter((id) => Number.isFinite(id) && id > 0));
  if (!want.size) return new Map();
  const boot = await getFplBootstrapStatic();
  const teamName = new Map<number, string>();
  for (const team of boot.teams ?? []) {
    const id = Number(team.id);
    if (Number.isFinite(id)) teamName.set(id, String(team.short_name ?? "").trim());
  }
  const out = new Map<number, PlayerMeta>();
  for (const el of boot.elements ?? []) {
    const id = Number(el.id);
    if (!want.has(id)) continue;
    const teamId = Number(el.team);
    const type = Number(el.element_type);
    out.set(id, {
      fpl_id: id,
      web_name: el.web_name?.trim() || null,
      team: Number.isFinite(teamId) ? teamName.get(teamId) || null : null,
      team_id: Number.isFinite(teamId) ? teamId : null,
      position: POS_BY_TYPE[type] ?? null,
      base_price: el.now_cost != null ? Number(el.now_cost) / 10 : null,
      status: el.status ?? null,
      chance_of_playing:
        el.chance_of_playing_this_round != null
          ? Number(el.chance_of_playing_this_round)
          : null,
      news: el.news?.trim() || null,
    });
  }
  return out;
}

function metaIncomplete(meta: PlayerMeta | undefined): boolean {
  if (!meta) return true;
  const name = meta.web_name?.trim() ?? "";
  if (!name || /^#\d+$/.test(name)) return true;
  if (meta.team_id == null || !Number.isFinite(meta.team_id)) return true;
  return false;
}

async function fillMissingMeta(
  metaById: Map<number, PlayerMeta>,
  ids: number[],
): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => id > 0 && metaIncomplete(metaById.get(id)));
  if (!missing.length) return;
  try {
    const extra = await loadMetaFromBootstrap(missing);
    for (const [id, row] of extra) metaById.set(id, row);
  } catch {
    /* optional */
  }
}

type RivalPicks = {
  entry: number;
  captainId: number | null;
  ids: number[];
  starterIds: number[];
  chip: string | null;
  event: number | null;
  points: number | null;
  total: number | null;
};

function emptyRivalPicks(entry: number): RivalPicks {
  return {
    entry,
    captainId: null,
    ids: [],
    starterIds: [],
    chip: null,
    event: null,
    points: null,
    total: null,
  };
}

function rivalPicksFromResponse(entry: number, picks: FplPicksResponse | null): RivalPicks {
  if (!picks?.picks?.length) return emptyRivalPicks(entry);
  const captain = picks.picks.find((p) => p.is_captain);
  const eh = picks.entry_history;
  const event = Number(eh?.event);
  const points = Number(eh?.points);
  const total = Number(eh?.total_points);
  return {
    entry,
    captainId: captain?.element ?? null,
    ids: picks.picks.map((p) => p.element),
    starterIds: picks.picks.filter((p) => p.position <= 11).map((p) => p.element),
    chip: picks.active_chip ?? null,
    event: Number.isFinite(event) && event > 0 ? event : null,
    points: Number.isFinite(points) ? points : null,
    total: Number.isFinite(total) ? total : null,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

function toSummary(
  league: {
    id: number;
    name: string;
    league_type?: string;
    scoring?: string | null;
    start_event?: number | null;
    closed?: boolean;
    entry_rank?: number | null;
    entry_last_rank?: number | null;
    entry_can_admin?: boolean;
  },
  format: MiniLeagueFormat,
): MiniLeagueSummary {
  const move = rankMove(league.entry_rank, league.entry_last_rank);
  return {
    id: league.id,
    name: league.name,
    kind: classifyClassicLeague(league),
    format,
    scoring: league.scoring ?? null,
    startEvent: league.start_event ?? null,
    closed: Boolean(league.closed),
    rank: league.entry_rank ?? null,
    lastRank: league.entry_last_rank && league.entry_last_rank > 0 ? league.entry_last_rank : null,
    rankDelta: move.delta,
    rankDir: move.dir,
    admin: Boolean(league.entry_can_admin),
  };
}

type StandingsResult = {
  id?: number;
  event_total?: number;
  player_name?: string;
  rank?: number;
  last_rank?: number;
  total?: number;
  entry?: number;
  entry_name?: string;
  points_for?: number;
};

function standingRow(
  raw: StandingsResult,
  youEntryId: number,
  squadDiff: number | null = null,
  tablePos: number | null = null,
): MiniLeagueStandingRow | null {
  const entry = Number(raw?.entry);
  const rank = Number(raw?.rank);
  if (!Number.isFinite(entry) || !Number.isFinite(rank)) return null;
  const lastRankRaw = Number(raw?.last_rank);
  const lastRank = Number.isFinite(lastRankRaw) && lastRankRaw > 0 ? lastRankRaw : null;
  const move = rankMove(rank, lastRank);
  const pointsForRaw = Number(raw?.points_for);
  return {
    entry,
    entryName: String(raw?.entry_name ?? "").trim() || `#${entry}`,
    playerName: String(raw?.player_name ?? "").trim() || "—",
    rank,
    lastRank,
    rankDelta: move.delta,
    rankDir: move.dir,
    eventTotal: Number(raw?.event_total) || 0,
    total: Number(raw?.total) || 0,
    pointsFor: Number.isFinite(pointsForRaw) ? pointsForRaw : null,
    squadDiffPct: squadDiff,
    tablePos,
    isYou: entry === youEntryId,
  };
}

async function fetchStandingsPage(
  leagueId: number,
  page: number,
  format: MiniLeagueFormat,
): Promise<{
  league: ClassicStandingsApi["league"];
  results: StandingsResult[];
  hasNext: boolean;
  page: number;
}> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const path =
    format === "h2h"
      ? `/leagues-h2h/${leagueId}/standings/?page_standings=${safePage}`
      : `/leagues-classic/${leagueId}/standings/?page_standings=${safePage}`;
  const data = await fplGet<ClassicStandingsApi>(path);
  return {
    league: data.league,
    results: data.standings?.results ?? [],
    hasNext: Boolean(data.standings?.has_next),
    page: data.standings?.page ?? safePage,
  };
}

function mergeStandingResults(
  packs: Array<{ results: StandingsResult[] }>,
): StandingsResult[] {
  const seen = new Set<number>();
  const out: StandingsResult[] = [];
  for (const pack of packs) {
    for (const row of pack.results ?? []) {
      const id = Number(row.entry);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
  }
  return out;
}

type StandingsPack = Awaited<ReturnType<typeof fetchStandingsPage>>;

function packHasEntry(pack: StandingsPack, entryId: number): number {
  return (pack.results ?? []).findIndex((row) => Number(row.entry) === entryId);
}

async function collectStandingsPages(
  leagueId: number,
  format: MiniLeagueFormat,
  pages: number[],
  collected: Map<number, StandingsPack>,
): Promise<void> {
  const missing = [
    ...new Set(pages.filter((page) => Number.isFinite(page) && page >= 1 && !collected.has(page))),
  ];
  if (!missing.length) return;
  const packs = await Promise.all(
    missing.map(async (page) => {
      try {
        return { requested: page, pack: await fetchStandingsPage(leagueId, page, format) };
      } catch {
        return { requested: page, pack: null };
      }
    }),
  );
  for (const { requested, pack } of packs) {
    if (pack) collected.set(requested, pack);
  }
}

function findEntryInCollected(
  collected: Map<number, StandingsPack>,
  entryId: number,
): { page: number; index: number } | null {
  const pages = [...collected.keys()].sort((a, b) => a - b);
  for (const page of pages) {
    const pack = collected.get(page);
    if (!pack) continue;
    const index = packHasEntry(pack, entryId);
    if (index >= 0) return { page, index };
  }
  return null;
}

function frontierAfterHint(
  collected: Map<number, StandingsPack>,
  hint: number,
): StandingsPack | null {
  const pages = [...collected.keys()].filter((page) => page >= hint);
  if (!pages.length) return null;
  return collected.get(Math.max(...pages)) ?? null;
}

/**
 * FPL `entry_rank` is a competition rank with ties, not a row index.
 * Rank 1560 can sit many pages after ceil(1560/50) when hundreds share that rank.
 * Scan forward from the hint page until this entry appears.
 */
async function locateEntryStandingsPages(
  leagueId: number,
  entryId: number,
  youRank: number | null,
  format: MiniLeagueFormat,
  page1: StandingsPack,
): Promise<{ collected: Map<number, StandingsPack>; hit: { page: number; index: number } | null }> {
  const collected = new Map<number, StandingsPack>();
  collected.set(1, page1);
  const hint = standingsPageForRank(youRank);
  await collectStandingsPages(
    leagueId,
    format,
    hint > 1 ? [hint - 1, hint] : [hint],
    collected,
  );

  let scanned = 0;
  while (true) {
    const frontier = frontierAfterHint(collected, hint);
    if (
      !shouldContinueStandingsScan({
        found: findEntryInCollected(collected, entryId) != null,
        scanned,
        maxPages: STANDINGS_SCAN_MAX_PAGES,
        frontierLoaded: frontier != null,
        frontierHasNext: frontier?.hasNext,
        lastRank: frontier?.results.at(-1)?.rank ?? null,
        youRank,
      })
    ) {
      break;
    }
    const nextPages = nextStandingsScanPages([...collected.keys()], hint, STANDINGS_SCAN_BATCH);
    const sizeBefore = collected.size;
    await collectStandingsPages(leagueId, format, nextPages, collected);
    scanned += STANDINGS_SCAN_BATCH;
    if (collected.size === sizeBefore) break;
  }

  const hit = findEntryInCollected(collected, entryId);
  if (hit) {
    const pack = collected.get(hit.page);
    const neighbors = new Set([
      ...neighborStandingsPages(hit.page, hit.index, pack?.results.length ?? 0),
      hit.page - 1,
      hit.page,
      hit.page + 1,
    ]);
    await collectStandingsPages(
      leagueId,
      format,
      [...neighbors].filter((page) => page >= 1),
      collected,
    );
  }

  return { collected, hit };
}

interface LeagueWindow {
  gw: number;
  fixtureGw: number;
  youRank: number | null;
  leagueFromEntry:
    | {
        id?: number;
        name?: string | null;
        league_type?: string | null;
        scoring?: string | null;
        start_event?: number | null;
        closed?: boolean;
        entry_rank?: number | null;
        entry_last_rank?: number | null;
      }
    | undefined;
  leagueMeta: ClassicStandingsApi["league"];
  standings: MiniLeagueStandingRow[];
  you: MiniLeagueStandingRow | null;
  leader: MiniLeagueStandingRow | null;
  nextRival: MiniLeagueStandingRow | null;
  below: MiniLeagueStandingRow | null;
  sampleRows: MiniLeagueStandingRow[];
  memberCount: number;
  memberCountExact: boolean;
  yourStandingsPage: number | null;
};

async function loadLeagueWindowFresh(
  entryId: number,
  leagueId: number,
  format: MiniLeagueFormat,
): Promise<LeagueWindow> {
  const [gws, page1, entry] = await Promise.all([
    resolveMiniLeagueGws(),
    fetchStandingsPage(leagueId, 1, format),
    fplGet<FplEntry>(`/entry/${entryId}/`),
  ]);
  const gw = gws.picksGw;
  const fixtureGw = gws.fixtureGw;
  const leagueFromEntry =
    format === "h2h"
      ? entry.leagues?.h2h?.find((l) => l.id === leagueId)
      : entry.leagues?.classic?.find((l) => l.id === leagueId);
  const youRank = leagueFromEntry?.entry_rank ?? null;
  const { collected, hit } = await locateEntryStandingsPages(
    leagueId,
    entryId,
    youRank,
    format,
    page1,
  );

  const aroundPages = hit
    ? [hit.page - 1, hit.page, hit.page + 1].filter((page) => page >= 1 && collected.has(page))
    : [];
  const aroundPacks = aroundPages
    .map((page) => collected.get(page))
    .filter((pack): pack is StandingsPack => pack != null);
  const aroundRaw = mergeStandingResults(aroundPacks);
  const startPos = aroundPages[0]
    ? (aroundPages[0] - 1) * STANDINGS_PAGE_SIZE + 1
    : 1;
  const standings = aroundRaw
    .map((row, i) => standingRow(row, entryId, null, startPos + i))
    .filter((row): row is MiniLeagueStandingRow => row != null);

  // Keep FPL table order (not rank-then-entry). Ties share a rank, so sorting
  // by rank would scramble the 10-above / 10-below neighbors.
  const leaderRaw = page1.results[0];
  const leader =
    (leaderRaw ? standingRow(leaderRaw, entryId) : null) ?? standings[0] ?? null;

  const you = standings.find((row) => row.isYou) ?? null;
  const youIdx = you ? standings.findIndex((row) => row.entry === you.entry) : -1;
  const nextRival = youIdx > 0 ? standings[youIdx - 1] ?? null : null;
  const below = youIdx >= 0 ? standings[youIdx + 1] ?? null : null;
  const sampleRows = pickRivalSample(standings, entryId);

  const memberCountExact = !page1.hasNext;
  const memberCount = memberCountExact
    ? page1.results.length
    : Math.max(
        youRank ?? 0,
        hit ? hit.page * STANDINGS_PAGE_SIZE : 0,
        ...standings.map((row) => row.rank),
        STANDINGS_PAGE_SIZE,
      );

  return {
    gw,
    fixtureGw,
    youRank,
    leagueFromEntry,
    leagueMeta: page1.league,
    standings,
    you,
    leader,
    nextRival,
    below,
    sampleRows,
    memberCount,
    memberCountExact,
    yourStandingsPage: hit?.page ?? null,
  };
}

function leagueWindowKey(entryId: number, leagueId: number, format: MiniLeagueFormat): string {
  return `${format}:${leagueId}:${entryId}`;
}

async function loadLeagueWindow(
  entryId: number,
  leagueId: number,
  format: MiniLeagueFormat,
): Promise<LeagueWindow> {
  const key = leagueWindowKey(entryId, leagueId, format);
  const cached = memoGet(windowCache, key);
  if (cached) return cached;
  const inflight = windowInflight.get(key);
  if (inflight) return inflight;
  const pending = loadLeagueWindowFresh(entryId, leagueId, format)
    .then((value) => {
      windowCache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      windowInflight.delete(key);
    });
  windowInflight.set(key, pending);
  return pending;
}

function formatFixture(oppShort: string | undefined, home: boolean | undefined): string | null {
  if (!oppShort) return null;
  return `${oppShort} (${home ? "H" : "A"})`;
}

async function stampFixtures(refs: MiniLeaguePlayerRef[]): Promise<void> {
  if (!refs.length) return;
  try {
    const map = await nextFixtureForPlayers(refs.map((r) => r.fplId));
    for (const ref of refs) {
      const fx = map.get(ref.fplId);
      ref.fixture = formatFixture(fx?.opp_short, fx?.home);
    }
  } catch {
    /* fixtures are optional */
  }
}

async function fetchPicksUncached(
  entryId: number,
  gw: number,
): Promise<FplPicksResponse | null> {
  try {
    return await fplGet<FplPicksResponse>(`/entry/${entryId}/event/${gw}/picks/`);
  } catch {
    if (gw > 1) {
      try {
        return await fplGet<FplPicksResponse>(`/entry/${entryId}/event/${gw - 1}/picks/`);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function fetchPicks(
  entryId: number,
  gw: number,
): Promise<FplPicksResponse | null> {
  const key = `${entryId}:${gw}`;
  const cached = memoGet(picksCache, key);
  if (cached !== undefined) return cached;
  const inflight = picksInflight.get(key);
  if (inflight) return inflight;
  const pending = fetchPicksUncached(entryId, gw)
    .then((value) => {
      picksCache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      picksInflight.delete(key);
    });
  picksInflight.set(key, pending);
  return pending;
}

function healthKind(
  status: string | null,
): MiniLeagueHealthFlag["kind"] | null {
  if (status === "i") return "injured";
  if (status === "d") return "doubtful";
  if (status === "s") return "suspended";
  if (status === "u" || status === "n") return "unavailable";
  return null;
}

function toRef(
  meta: PlayerMeta | undefined,
  fplId: number,
  xp: number | null,
): MiniLeaguePlayerRef {
  return {
    fplId,
    webName: meta?.web_name?.trim() || `#${fplId}`,
    team: meta?.team ?? null,
    position: meta?.position ?? null,
    price: meta?.base_price != null ? Number(meta.base_price) : null,
    status: meta?.status ?? null,
    chance: meta?.chance_of_playing != null ? Number(meta.chance_of_playing) : null,
    news: meta?.news?.trim() || null,
    fixture: null,
    xp,
  };
}

export async function loadMiniLeagueIndex(entryId: number): Promise<MiniLeagueIndex> {
  const entry = await fplGet<FplEntry>(`/entry/${entryId}/`);
  const classic = (entry.leagues?.classic ?? [])
    .filter((league) => Number.isFinite(league.id) && league.name)
    .map((league) => toSummary(league, "classic"))
    .sort((a, b) => {
      const kindOrder = { mini: 0, public: 1, overall: 2 };
      const kd = kindOrder[a.kind] - kindOrder[b.kind];
      if (kd !== 0) return kd;
      return (a.rank ?? 9999) - (b.rank ?? 9999);
    });
  const h2h = (entry.leagues?.h2h ?? [])
    .filter((league) => Number.isFinite(league.id) && league.name)
    .map((league) => toSummary(league, "h2h"));

  return {
    entryId,
    teamName: entry.name,
    managerName: [entry.player_first_name, entry.player_last_name]
      .filter(Boolean)
      .join(" "),
    currentGw: entry.current_event,
    classic,
    h2h,
  };
}

export async function loadMiniLeagueAnalysis(
  entryId: number,
  leagueId: number,
  format: MiniLeagueFormat = "classic",
): Promise<MiniLeagueAnalysis> {
  const window = await loadLeagueWindow(entryId, leagueId, format);
  const {
    gw,
    youRank,
    leagueFromEntry,
    leagueMeta,
    standings,
    you,
    leader,
    nextRival,
    sampleRows,
    memberCount,
    memberCountExact,
    yourStandingsPage,
  } = window;

  const league: MiniLeagueSummary = toSummary(
    {
      id: leagueId,
      name: leagueMeta?.name || leagueFromEntry?.name || `League ${leagueId}`,
      league_type: leagueMeta?.league_type || leagueFromEntry?.league_type || undefined,
      scoring: leagueMeta?.scoring ?? leagueFromEntry?.scoring,
      start_event: leagueMeta?.start_event ?? leagueFromEntry?.start_event,
      closed: leagueMeta?.closed ?? leagueFromEntry?.closed,
      entry_rank: you?.rank ?? youRank ?? null,
      entry_last_rank: you?.lastRank ?? leagueFromEntry?.entry_last_rank ?? null,
    },
    format,
  );

  const sampleIncomplete = memberCountExact
    ? sampleRows.length < standings.length
    : true;

  const picksList = await mapPool(sampleRows, PICKS_CONCURRENCY, async (row) =>
    rivalPicksFromResponse(row.entry, await fetchPicks(row.entry, gw)),
  );

  let yourPicks = picksList.find((p) => p.entry === entryId) ?? emptyRivalPicks(entryId);
  if (!yourPicks.ids.length) {
    yourPicks = rivalPicksFromResponse(entryId, await fetchPicks(entryId, gw));
  }
  const yourSet = new Set(yourPicks.ids);
  const sampledWithSquad = picksList.filter((p) => p.ids.length > 0);
  const managerCount = Math.max(sampledWithSquad.length, 1);

  const allIds = [...new Set(picksList.flatMap((p) => p.ids))];
  const metaById = new Map<number, PlayerMeta>();
  if (allIds.length) {
    try {
      const supa = getServerSupabase();
      const { data: playerRows } = await supa
        .from("players_static")
        .select("fpl_id,web_name,team,team_id,position,base_price,status,chance_of_playing,news")
        .in("fpl_id", allIds);
      for (const row of playerRows ?? []) {
        metaById.set(Number(row.fpl_id), row as PlayerMeta);
      }
    } catch {
      /* Player names/xP still render from FPL ids when DB is unavailable. */
    }
  }
  await fillMissingMeta(metaById, allIds);

  let xpById = new Map<number, number>();
  try {
    const fromGw = gw;
    const toGw = gw + 2;
    const projections = await projectPlayers(allIds, {
      currentGw: gw,
      fromGw,
      toGw,
    });
    for (const [id, proj] of projections) {
      xpById.set(id, proj.xp_total);
    }
  } catch {
    xpById = new Map();
  }

  const owners = new Map<number, { owners: number; captains: number }>();
  for (const squad of sampledWithSquad) {
    const seen = new Set<number>();
    for (const id of squad.ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const cur = owners.get(id) ?? { owners: 0, captains: 0 };
      cur.owners += 1;
      owners.set(id, cur);
    }
    if (squad.captainId) {
      const cur = owners.get(squad.captainId) ?? { owners: 0, captains: 0 };
      cur.captains += 1;
      owners.set(squad.captainId, cur);
    }
  }

  const ownedPlayers: MiniLeagueOwnedPlayer[] = [...owners.entries()]
    .map(([fplId, counts]) => {
      const ref = toRef(metaById.get(fplId), fplId, xpById.get(fplId) ?? null);
      return {
        ...ref,
        owners: counts.owners,
        ownerPct: counts.owners / managerCount,
        youOwn: yourSet.has(fplId),
        captainOwners: counts.captains,
      };
    })
    .sort((a, b) => b.ownerPct - a.ownerPct || (b.xp ?? 0) - (a.xp ?? 0));

  const template = ownedPlayers.filter(
    (p) => p.ownerPct >= TEMPLATE_PCT && p.owners >= TEMPLATE_MIN_OWNERS,
  );
  const differentials = ownedPlayers
    .filter((p) => p.youOwn && p.owners <= 2)
    .sort((a, b) => a.owners - b.owners || (b.xp ?? 0) - (a.xp ?? 0));
  const missingTemplate = template.filter((p) => !p.youOwn);

  const youSampleIdx = you
    ? sampleRows.findIndex((row) => row.entry === you.entry)
    : -1;
  const aboveYou = youSampleIdx > 0 ? sampleRows.slice(0, youSampleIdx) : [];
  const aboveSet = new Set(aboveYou.map((row) => row.entry));
  const aboveSquads = sampledWithSquad.filter((s) => aboveSet.has(s.entry));
  const aboveCount = Math.max(aboveSquads.length, 1);
  const aboveOwners = new Map<number, number>();
  for (const squad of aboveSquads) {
    for (const id of new Set(squad.ids)) {
      aboveOwners.set(id, (aboveOwners.get(id) ?? 0) + 1);
    }
  }

  const transfersIn: MiniLeagueTransferIdea[] = [...aboveOwners.entries()]
    .filter(([id]) => !yourSet.has(id))
    .map(([fplId, ownersAbove]) => {
      const ref = toRef(metaById.get(fplId), fplId, xpById.get(fplId) ?? null);
      const ownerPctAbove = ownersAbove / aboveCount;
      const inTemplate = missingTemplate.some((p) => p.fplId === fplId);
      return {
        ...ref,
        ownersAbove,
        ownerPctAbove,
        reason: (inTemplate ? "template_gap" : "rival_cover") as MiniLeagueTransferIdea["reason"],
      };
    })
    .sort(
      (a, b) =>
        b.ownerPctAbove - a.ownerPctAbove || (b.xp ?? 0) - (a.xp ?? 0),
    )
    .slice(0, 8);

  const transfersOut: MiniLeagueSellIdea[] = yourPicks.ids
    .map((fplId) => {
      const ref = toRef(metaById.get(fplId), fplId, xpById.get(fplId) ?? null);
      const owned = ownedPlayers.find((p) => p.fplId === fplId);
      const kind = healthKind(ref.status);
      if (kind && kind !== "news") {
        return {
          ...ref,
          ownerPct: owned?.ownerPct ?? 0,
          reason: "availability" as const,
        };
      }
      if ((owned?.owners ?? 1) <= 1 && (ref.xp ?? 0) < 8) {
        return {
          ...ref,
          ownerPct: owned?.ownerPct ?? 0,
          reason: "unique_low_xp" as const,
        };
      }
      return null;
    })
    .filter((row): row is MiniLeagueSellIdea => row != null)
    .slice(0, 6);

  await stampFixtures([...transfersIn, ...transfersOut]);

  const health: MiniLeagueHealthFlag[] = yourPicks.ids
    .map((fplId) => {
      const meta = metaById.get(fplId);
      const kind = healthKind(meta?.status ?? null);
      const news = meta?.news?.trim() || "";
      if (!kind && !news) return null;
      const note =
        meta?.chance_of_playing != null
          ? `${meta.chance_of_playing}%`
          : news.slice(0, 120) || kind || "news";
      return {
        fplId,
        webName: meta?.web_name?.trim() || `#${fplId}`,
        kind: kind ?? "news",
        note,
      } satisfies MiniLeagueHealthFlag;
    })
    .filter((row): row is MiniLeagueHealthFlag => row != null)
    .slice(0, 8);

  const leagueTopCaptain = ownedPlayers
    .filter((p) => p.captainOwners > 0)
    .sort((a, b) => b.captainOwners - a.captainOwners)[0] ?? null;

  const idsByEntry = new Map(picksList.map((p) => [p.entry, p.ids]));
  if (yourPicks.ids.length) idsByEntry.set(entryId, yourPicks.ids);
  const withSquadDiff = (row: MiniLeagueStandingRow | null): MiniLeagueStandingRow | null => {
    if (!row) return null;
    return {
      ...row,
      squadDiffPct: squadDiffPct(yourPicks.ids, idsByEntry.get(row.entry) ?? []),
    };
  };
  const standingsWithDiff = sampleRows
    .map((row) => withSquadDiff(row))
    .filter((row): row is MiniLeagueStandingRow => row != null);

  return {
    league,
    format,
    gw,
    memberCount,
    memberCountExact,
    sampledManagers: sampledWithSquad.length,
    sampleIncomplete,
    yourStandingsPage,
    you: withSquadDiff(you),
    leader: withSquadDiff(leader),
    gapToLeader: you && leader ? Math.max(0, leader.total - you.total) : null,
    gapToNext: you && nextRival ? Math.max(0, nextRival.total - you.total) : null,
    pointsToCatchNext: you && nextRival ? pointsToCatch(you.total, nextRival.total) : null,
    standings: standingsWithDiff,
    movers: sortMovers(standings).slice(0, 8),
    template: template.slice(0, 12),
    differentials: differentials.slice(0, 10),
    missingTemplate: missingTemplate.slice(0, 8),
    captain: {
      yours: yourPicks.captainId
        ? toRef(
            metaById.get(yourPicks.captainId),
            yourPicks.captainId,
            xpById.get(yourPicks.captainId) ?? null,
          )
        : null,
      leagueTop: leagueTopCaptain,
    },
    transfersIn,
    transfersOut,
    health,
  };
}

async function loadPlayerBundle(ids: number[]): Promise<{
  metaById: Map<number, PlayerMeta>;
  xpById: Map<number, number>;
}> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  const metaById = new Map<number, PlayerMeta>();
  if (unique.length) {
    try {
      const supa = getServerSupabase();
      const { data: playerRows } = await supa
        .from("players_static")
        .select("fpl_id,web_name,team,team_id,position,base_price,status,chance_of_playing,news")
        .in("fpl_id", unique);
      for (const row of playerRows ?? []) {
        metaById.set(Number(row.fpl_id), row as PlayerMeta);
      }
    } catch {
      /* fallback: refs show #id */
    }
  }
  await fillMissingMeta(metaById, unique);

  let xpById = new Map<number, number>();
  try {
    const gws = await resolveMiniLeagueGws();
    const gw = gws.picksGw;
    const projections = await projectPlayers(unique, {
      currentGw: gw,
      fromGw: gw,
      toGw: gw + 2,
    });
    for (const [id, proj] of projections) {
      xpById.set(id, proj.xp_total);
    }
  } catch {
    xpById = new Map();
  }

  return { metaById, xpById };
}

function managerNameOf(entry: FplEntry): string {
  return [entry.player_first_name, entry.player_last_name].filter(Boolean).join(" ");
}

function squadFromPicks(
  entry: FplEntry,
  picks: FplPicksResponse | null,
  metaById: Map<number, PlayerMeta>,
  xpById: Map<number, number>,
): MiniLeagueManagerSquad {
  const list: MiniLeagueSquadPick[] = (picks?.picks ?? [])
    .map((p) => {
      const ref = toRef(metaById.get(p.element), p.element, xpById.get(p.element) ?? null);
      return {
        ...ref,
        slot: p.position,
        captain: Boolean(p.is_captain),
        vice: Boolean(p.is_vice_captain),
        starter: p.position <= 11,
      };
    })
    .sort((a, b) => a.slot - b.slot);
  return {
    entry: entry.id,
    teamName: entry.name,
    managerName: managerNameOf(entry),
    points: entry.summary_overall_points,
    picks: list,
  };
}

export async function loadRivalCompare(
  youEntryId: number,
  rivalEntryId: number,
): Promise<MiniLeagueRivalCompare> {
  const gws = await resolveMiniLeagueGws();
  const gw = gws.picksGw;
  const [youEntry, rivalEntry, youPicks, rivalPicks] = await Promise.all([
    fplGet<FplEntry>(`/entry/${youEntryId}/`),
    fplGet<FplEntry>(`/entry/${rivalEntryId}/`),
    fetchPicks(youEntryId, gw),
    fetchPicks(rivalEntryId, gw),
  ]);

  const ids = [
    ...(youPicks?.picks ?? []).map((p) => p.element),
    ...(rivalPicks?.picks ?? []).map((p) => p.element),
  ];
  const { metaById, xpById } = await loadPlayerBundle(ids);
  const you = squadFromPicks(youEntry, youPicks, metaById, xpById);
  const rival = squadFromPicks(rivalEntry, rivalPicks, metaById, xpById);
  await stampFixtures([...you.picks, ...rival.picks]);
  const youSet = new Set(you.picks.map((p) => p.fplId));
  const rivalSet = new Set(rival.picks.map((p) => p.fplId));

  const theyHaveYouDont = rival.picks
    .filter((p) => !youSet.has(p.fplId))
    .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));
  const youHaveTheyDont = you.picks
    .filter((p) => !rivalSet.has(p.fplId))
    .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));

  const pointsGap =
    you.points != null && rival.points != null ? rival.points - you.points : null;

  return {
    gw,
    you,
    rival,
    theyHaveYouDont,
    youHaveTheyDont,
    pointsGap,
  };
}

export async function loadMiniLeagueStandingsPage(
  youEntryId: number,
  leagueId: number,
  page: number,
  format: MiniLeagueFormat = "classic",
): Promise<MiniLeagueStandingsPage> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const [gwsResolved, pack] = await Promise.all([
    resolveMiniLeagueGws(),
    fetchStandingsPage(leagueId, safePage, format),
  ]);
  const gw = gwsResolved.picksGw;
  const rows = (pack.results ?? [])
    .map((row, i) =>
      standingRow(row, youEntryId, null, (safePage - 1) * STANDINGS_PAGE_SIZE + i + 1),
    )
    .filter((row): row is MiniLeagueStandingRow => row != null);

  const idsByEntry = new Map<number, number[]>();
  try {
    const youPicks = await fetchPicks(youEntryId, gw);
    const youIds = (youPicks?.picks ?? []).map((p) => p.element);
    idsByEntry.set(youEntryId, youIds);
    // Small leagues: every rival. Huge 50-row pages: nearby rivals only (avoid 403).
    if (youIds.length) {
      const extra = await mapPool(
        pickSquadDiffEntries(
          rows.map((row) => row.entry),
          youEntryId,
          { hasNext: pack.hasNext },
        ),
        PICKS_CONCURRENCY,
        async (entry) => ({
          entry,
          ids: ((await fetchPicks(entry, gw))?.picks ?? []).map((p) => p.element),
        }),
      );
      for (const loaded of extra) idsByEntry.set(loaded.entry, loaded.ids);
    }
  } catch {
    /* standings still render without squad-diff */
  }
  const youIds = idsByEntry.get(youEntryId) ?? [];

  return {
    format,
    page: pack.page,
    pageSize: STANDINGS_PAGE_SIZE,
    hasNext: pack.hasNext,
    hasPrev: safePage > 1,
    rows: rows.map((row) => ({
      ...row,
      squadDiffPct: squadDiffPct(youIds, idsByEntry.get(row.entry) ?? []),
    })),
  };
}

export async function loadManagerHistory(
  entryId: number,
): Promise<MiniLeagueManagerHistory> {
  const [entry, history] = await Promise.all([
    fplGet<FplEntry>(`/entry/${entryId}/`),
    fplGet<FplHistoryResponse>(`/entry/${entryId}/history/`),
  ]);
  return {
    entry: entry.id,
    teamName: entry.name,
    managerName: managerNameOf(entry),
    overallRank: entry.summary_overall_rank,
    overallPoints: entry.summary_overall_points,
    current: (history.current ?? []).map((row) => ({
      event: row.event,
      points: row.points,
      total: row.total_points,
      overallRank: row.overall_rank ?? null,
      transfers: row.event_transfers ?? null,
      hits: row.event_transfers_cost ?? null,
    })),
    chips: (history.chips ?? []).map((c) => ({ name: c.name, event: c.event })),
    past: [...(history.past ?? [])]
      .slice()
      .reverse()
      .map((s) => ({
        season: s.season_name,
        rank: s.rank,
        points: s.total_points,
      })),
  };
}

type StandingsContext = {
  gw: number;
  fixtureGw: number;
  standings: MiniLeagueStandingRow[];
  you: MiniLeagueStandingRow | null;
  leader: MiniLeagueStandingRow | null;
  nextRival: MiniLeagueStandingRow | null;
  below: MiniLeagueStandingRow | null;
  sampleRows: MiniLeagueStandingRow[];
};

async function loadStandingsContext(
  entryId: number,
  leagueId: number,
  format: MiniLeagueFormat,
): Promise<StandingsContext> {
  const window = await loadLeagueWindow(entryId, leagueId, format);
  return {
    gw: window.gw,
    fixtureGw: window.fixtureGw,
    standings: window.standings,
    you: window.you,
    leader: window.leader,
    nextRival: window.nextRival,
    below: window.below,
    sampleRows: window.sampleRows,
  };
}

async function fetchHistoryPackUncached(entryId: number): Promise<HistoryPack | null> {
  try {
    const history = await fplGet<FplHistoryResponse>(`/entry/${entryId}/history/`);
    return {
      entry: entryId,
      current: history.current ?? [],
      chips: history.chips ?? [],
    };
  } catch {
    return null;
  }
}

async function fetchHistoryPack(entryId: number): Promise<HistoryPack | null> {
  const key = String(entryId);
  const cached = memoGet(historyCache, key);
  if (cached !== undefined) return cached;
  const inflight = historyInflight.get(key);
  if (inflight) return inflight;
  const pending = fetchHistoryPackUncached(entryId)
    .then((value) => {
      historyCache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      historyInflight.delete(key);
    });
  historyInflight.set(key, pending);
  return pending;
}

function pickOverallEntries(ctx: StandingsContext, youEntryId: number): MiniLeagueStandingRow[] {
  if (ctx.sampleRows.length) return ctx.sampleRows;
  const out: MiniLeagueStandingRow[] = [];
  const seen = new Set<number>();
  const push = (row: MiniLeagueStandingRow | null | undefined) => {
    if (!row || seen.has(row.entry)) return;
    seen.add(row.entry);
    out.push(row);
  };
  push(ctx.you ?? ctx.sampleRows.find((r) => r.entry === youEntryId) ?? null);
  push(ctx.leader);
  push(ctx.nextRival);
  push(ctx.below);
  return out;
}

function seriesRole(
  row: MiniLeagueStandingRow,
  ctx: StandingsContext,
  youEntryId: number,
) {
  return rankChartRole(
    row,
    youEntryId,
    ctx.leader?.entry ?? null,
    ctx.nextRival?.entry ?? null,
  );
}

type LiveElement = {
  id?: number;
  stats?: { total_points?: number; minutes?: number };
};

type LiveEventApi = {
  elements?: LiveElement[];
};

type LiveFixtureApi = {
  id?: number;
  event?: number;
  team_h?: number;
  team_a?: number;
  started?: boolean;
  finished?: boolean;
  finished_provisional?: boolean;
};

function liveGwStatus(fixtures: LiveFixtureApi[]): MiniLeagueLiveStatus {
  if (!fixtures.length) return "not_started";
  const anyStarted = fixtures.some((f) => Boolean(f.started));
  const allFinished = fixtures.every(
    (f) => Boolean(f.finished) || Boolean(f.finished_provisional),
  );
  if (!anyStarted) return "not_started";
  if (allFinished) return "finished";
  return "live";
}

async function loadLiveEvent(gw: number): Promise<{
  pointsById: Map<number, number>;
  fixtures: LiveFixtureApi[];
  status: MiniLeagueLiveStatus;
}> {
  const [live, fixtures] = await Promise.all([
    fplGet<LiveEventApi>(`/event/${gw}/live/`, { cacheBust: true }).catch(
      () => ({ elements: [] } as LiveEventApi),
    ),
    fplGet<LiveFixtureApi[]>(`/fixtures/?event=${gw}`, { cacheBust: true }).catch(
      () => [] as LiveFixtureApi[],
    ),
  ]);
  const pointsById = new Map<number, number>();
  for (const el of live.elements ?? []) {
    const id = Number(el.id);
    if (!Number.isFinite(id)) continue;
    pointsById.set(id, Number(el.stats?.total_points) || 0);
  }
  return { pointsById, fixtures, status: liveGwStatus(fixtures) };
}

function unfinishedTeamIds(fixtures: LiveFixtureApi[]): Set<number> {
  const out = new Set<number>();
  for (const fx of fixtures) {
    const done = Boolean(fx.finished) || Boolean(fx.finished_provisional);
    if (done) continue;
    const h = Number(fx.team_h);
    const a = Number(fx.team_a);
    if (Number.isFinite(h)) out.add(h);
    if (Number.isFinite(a)) out.add(a);
  }
  return out;
}

function packToTotals(pack: HistoryPack | null): HistoryGwTotals[] {
  return (pack?.current ?? []).map((row) => ({
    event: row.event,
    points: row.points,
    total: row.total_points,
    overallRank: row.overall_rank ?? null,
  }));
}

function totalsFromPicks(picks: RivalPicks | undefined): HistoryGwTotals[] {
  if (!picks || picks.event == null || picks.total == null) return [];
  return [
    {
      event: picks.event,
      points: picks.points ?? 0,
      total: picks.total,
      overallRank: null,
    },
  ];
}

function totalsFromStandings(row: MiniLeagueStandingRow, event: number): HistoryGwTotals[] {
  if (!Number.isFinite(row.total) || event < 1) return [];
  return [
    {
      event,
      points: Number.isFinite(row.eventTotal) ? row.eventTotal : 0,
      total: row.total,
      overallRank: null,
    },
  ];
}

function bestHistoryTotals(
  pack: HistoryPack | null,
  picks: RivalPicks | undefined,
  row: MiniLeagueStandingRow | undefined,
  event: number,
): HistoryGwTotals[] {
  const fromHistory = packToTotals(pack);
  if (fromHistory.length) return fromHistory;
  const fromPicks = totalsFromPicks(picks);
  if (fromPicks.length) return fromPicks;
  return row ? totalsFromStandings(row, event) : [];
}

function chipShort(name: string | null | undefined): string | null {
  if (!name) return null;
  const kind = classifyChipName(name);
  if (kind === "wildcard") return "WC";
  if (kind === "freehit") return "FH";
  if (kind === "bboost") return "BB";
  if (kind === "3xc") return "TC";
  return name.toUpperCase();
}

type FplFixtureRow = {
  event?: number;
  team_h?: number;
  team_a?: number;
  team_h_difficulty?: number;
  team_a_difficulty?: number;
};

async function loadFplFixturesWindow(
  fromGw: number,
  toGw: number,
): Promise<FplFixtureRow[]> {
  const inWindow = (row: FplFixtureRow) => {
    const event = Number(row.event);
    return Number.isFinite(event) && event >= fromGw && event <= toGw;
  };
  let rows: FplFixtureRow[] = [];
  try {
    const all = await fplGet<FplFixtureRow[]>("/fixtures/", { timeoutMs: 15_000, retries: 2 });
    rows = (all ?? []).filter(inWindow);
  } catch {
    const gws: number[] = [];
    for (let event = fromGw; event <= toGw; event++) gws.push(event);
    const packs = await Promise.all(
      gws.map((event) =>
        fplGet<FplFixtureRow[]>(`/fixtures/?event=${event}`, { retries: 1 }).catch(
          () => [] as FplFixtureRow[],
        ),
      ),
    );
    rows = packs.flat().filter(inWindow);
  }
  if (rows.length) return rows;
  try {
    const season = await getCurrentFplSeason();
    const db = await loadFixturesWindow(fromGw, toGw, season);
    return db.map((fx) => ({
      event: fx.gw,
      team_h: fx.home_team_id,
      team_a: fx.away_team_id,
      team_h_difficulty: fx.home_fdr ?? undefined,
      team_a_difficulty: fx.away_fdr ?? undefined,
    }));
  } catch {
    return [];
  }
}

function scoreLivePicks(
  picks: FplPicksResponse | null,
  pointsById: Map<number, number>,
  teamByPlayer: Map<number, number>,
  liveTeams: Set<number>,
): { livePoints: number; remaining: number; playing: number } {
  let livePoints = 0;
  let remaining = 0;
  let playing = 0;
  for (const pick of picks?.picks ?? []) {
    const mult = Number(pick.multiplier) || 0;
    if (mult <= 0) continue;
    playing += 1;
    livePoints += (pointsById.get(pick.element) ?? 0) * mult;
    const teamId = teamByPlayer.get(pick.element);
    if (teamId != null && liveTeams.has(teamId)) remaining += 1;
  }
  return { livePoints, remaining, playing };
}

function suggestBeatTransfer(
  theyHave: MiniLeaguePlayerRef[],
  youHave: MiniLeaguePlayerRef[],
): MiniLeagueBeatSuggestion | null {
  if (!theyHave.length || !youHave.length) return null;
  type Pair = { out: MiniLeaguePlayerRef; inn: MiniLeaguePlayerRef; delta: number };
  const pairs: Pair[] = [];
  for (const inn of theyHave) {
    const samePos = youHave.filter(
      (p) => p.position && inn.position && p.position === inn.position,
    );
    const pool = samePos.length ? samePos : youHave;
    let worst = pool[0]!;
    for (const cand of pool) {
      if ((cand.xp ?? 99) < (worst.xp ?? 99)) worst = cand;
    }
    const delta = (inn.xp ?? 0) - (worst.xp ?? 0);
    pairs.push({ out: worst, inn, delta });
  }
  pairs.sort((a, b) => b.delta - a.delta || (b.inn.xp ?? 0) - (a.inn.xp ?? 0));
  const best = pairs[0];
  if (!best) return null;
  return {
    out: best.out,
    in: best.inn,
    reason: best.delta >= 1.5 ? "xp" : "rival_cover",
    xpDelta: Number.isFinite(best.delta) ? Math.round(best.delta * 10) / 10 : null,
  };
}

async function loadSamplePicks(
  sampleRows: MiniLeagueStandingRow[],
  gw: number,
): Promise<RivalPicks[]> {
  return mapPool(sampleRows, PICKS_CONCURRENCY, async (row) =>
    rivalPicksFromResponse(row.entry, await fetchPicks(row.entry, gw)),
  );
}

async function buildFixtureRuns(
  picksList: RivalPicks[],
  runRows: Array<{
    entry: number;
    teamName: string;
    isYou: boolean;
    role: MiniLeagueRankChartRole;
  }>,
  gws: number[],
  currentGw: number,
): Promise<MiniLeagueFixtureRun[]> {
  if (!runRows.length) return [];
  const fromGw = gws[0] ?? currentGw;
  const toGw = gws[gws.length - 1] ?? currentGw;
  const starterIds = [
    ...new Set(
      runRows.flatMap((row) => {
        const picks = picksList.find((p) => p.entry === row.entry);
        return picks?.starterIds.length ? picks.starterIds : picks?.ids ?? [];
      }),
    ),
  ];
  const [fplFx, metaById] = await Promise.all([
    loadFplFixturesWindow(fromGw, toGw),
    (async () => {
      const map = new Map<number, PlayerMeta>();
      if (!starterIds.length) return map;
      try {
        const db = await loadPlayers(starterIds);
        for (const [id, p] of db) {
          map.set(id, {
            fpl_id: id,
            web_name: p.web_name ?? null,
            team: p.team ?? null,
            team_id: p.team_id ?? null,
            position: p.position ?? null,
            base_price: p.base_price ?? null,
            status: p.status ?? null,
            chance_of_playing: p.chance_of_playing ?? null,
            news: null,
          });
        }
      } catch {
        /* bootstrap overlay still runs */
      }
      await fillMissingMeta(map, starterIds);
      return map;
    })(),
  ]);

  let xpByPlayerGw = new Map<number, Map<number, number>>();
  try {
    const projections = await projectPlayers(starterIds, {
      currentGw,
      fromGw,
      toGw,
    });
    for (const [id, proj] of projections) {
      const byGw = new Map<number, number>();
      for (const fx of proj.fixtures) {
        byGw.set(fx.gw, (byGw.get(fx.gw) ?? 0) + fx.xp_total);
      }
      xpByPlayerGw.set(id, byGw);
    }
  } catch {
    xpByPlayerGw = new Map();
  }

  const fxFor = (teamId: number, event: number) =>
    fplFx.filter((row) => {
      if (Number(row.event) !== event) return false;
      return Number(row.team_h) === teamId || Number(row.team_a) === teamId;
    });
  const knownGws = new Set(
    fplFx
      .map((row) => Number(row.event))
      .filter((event) => Number.isFinite(event) && event > 0),
  );

  return runRows.map((row) => {
    const picks = picksList.find((p) => p.entry === row.entry);
    const ids = picks?.starterIds.length ? picks.starterIds : picks?.ids ?? [];
    const captainId = picks?.captainId ?? null;
    const cells = gws.map((event) => {
      const known = knownGws.has(event);
      const perPlayer = ids.map((id) => {
        const teamId = metaById.get(id)?.team_id;
        if (teamId == null) return 0;
        return fxFor(teamId, event).length;
      });
      const matches = perPlayer.length ? Math.max(...perPlayer) : 0;
      let fdrSum = 0;
      let fdrN = 0;
      const seenTeams = new Set<number>();
      for (const id of ids) {
        const teamId = metaById.get(id)?.team_id;
        if (teamId == null || seenTeams.has(teamId)) continue;
        seenTeams.add(teamId);
        for (const fx of fxFor(teamId, event)) {
          const fdr =
            Number(fx.team_h) === teamId
              ? Number(fx.team_h_difficulty)
              : Number(fx.team_a_difficulty);
          if (Number.isFinite(fdr) && fdr > 0) {
            fdrSum += fdr;
            fdrN += 1;
          }
        }
      }
      let xp: number | null = null;
      let xpSum = 0;
      let xpN = 0;
      for (const id of ids) {
        const val = xpByPlayerGw.get(id)?.get(event);
        if (val == null || !Number.isFinite(val)) continue;
        xpSum += val;
        xpN += 1;
        if (captainId === id) xpSum += val;
      }
      if (xpN) xp = Math.round(xpSum * 10) / 10;
      return {
        event,
        matches,
        fdrAvg: fdrN ? Math.round((fdrSum / fdrN) * 10) / 10 : null,
        xp,
        known,
      };
    });
    const xpParts = cells.map((c) => c.xp).filter((n): n is number => n != null);
    const fdrParts = cells.map((c) => c.fdrAvg).filter((n): n is number => n != null);
    return {
      entry: row.entry,
      teamName: row.teamName,
      isYou: row.isYou,
      role: row.role,
      cells,
      xpTotal: xpParts.length ? Math.round(xpParts.reduce((a, b) => a + b, 0) * 10) / 10 : null,
      fdrAvg: fdrParts.length
        ? Math.round((fdrParts.reduce((a, b) => a + b, 0) / fdrParts.length) * 10) / 10
        : null,
    };
  });
}

async function buildFixtureOverlap(
  youEntryId: number,
  picksList: RivalPicks[],
  gw: number,
  runRows: Array<{
    entry: number;
    teamName: string;
    isYou: boolean;
    role: MiniLeagueRankChartRole;
  }>,
): Promise<MiniLeagueFixtureOverlap> {
  const fromGw = gw;
  const toGw = Math.min(38, gw + 4);
  const gws: number[] = [];
  for (let n = fromGw; n <= toGw; n++) gws.push(n);

  const runs = await buildFixtureRuns(picksList, runRows, gws, gw);
  const yourPicks = picksList.find((p) => p.entry === youEntryId);
  const yourIds = yourPicks?.ids ?? [];
  const allIds = [...new Set(picksList.flatMap((p) => p.ids))];
  const empty: MiniLeagueFixtureOverlap = {
    fromGw,
    toGw,
    gws,
    runs,
    sharedDgw: [],
    blanks: [],
    sameOpp: [],
  };
  if (!allIds.length) return empty;

  let players: Awaited<ReturnType<typeof loadPlayers>>;
  let fixtures: Awaited<ReturnType<typeof loadFixturesWindow>>;
  let fplSeason: string;
  try {
    fplSeason = await getCurrentFplSeason();
    [players, fixtures] = await Promise.all([
      loadPlayers(allIds),
      loadFixturesWindow(fromGw, toGw, fplSeason),
    ]);
  } catch {
    return empty;
  }
  const dgwTeamIds = [
    ...new Set(
      [...players.values()]
        .map((p) => p.team_id)
        .filter((id): id is number => id != null && Number.isFinite(id)),
    ),
  ];
  const dgwKeys = await loadDoubleGameweekKeys(
    dgwTeamIds,
    fromGw,
    toGw,
    fplSeason,
  ).catch(() => new Set<string>());

  const teamByPlayer = new Map<number, { teamId: number; team: string; pos: string; name: string }>();
  for (const id of allIds) {
    const p = players.get(id);
    const teamId = p?.team_id != null ? Number(p.team_id) : null;
    if (teamId == null || !Number.isFinite(teamId)) continue;
    teamByPlayer.set(id, {
      teamId,
      team: p?.team?.trim() || `#${teamId}`,
      pos: (p?.position ?? "").toUpperCase(),
      name: p?.web_name?.trim() || `#${id}`,
    });
  }

  const fxByTeamGw = new Map<string, typeof fixtures>();
  for (const fx of fixtures) {
    for (const tid of [fx.home_team_id, fx.away_team_id]) {
      const key = `${tid}:${fx.gw}`;
      const list = fxByTeamGw.get(key) ?? [];
      list.push(fx);
      fxByTeamGw.set(key, list);
    }
  }

  const yourDefGkp = yourIds
    .map((id) => {
      const meta = teamByPlayer.get(id);
      if (!meta) return null;
      if (meta.pos !== "DEF" && meta.pos !== "GKP") return null;
      return { fplId: id, ...meta };
    })
    .filter((row): row is { fplId: number; teamId: number; team: string; pos: string; name: string } => row != null);

  const yourTeamIds = new Set(
    yourIds
      .map((id) => teamByPlayer.get(id)?.teamId)
      .filter((id): id is number => id != null),
  );

  const rivalEntries = picksList.filter((p) => p.entry !== youEntryId && p.ids.length);
  const sharedDgw: MiniLeagueFixtureClubShare[] = [];
  const blanks: MiniLeagueFixtureBlank[] = [];
  const sameOpp: MiniLeagueFixtureSameOpp[] = [];

  for (const event of gws) {
    for (const teamId of yourTeamIds) {
      if (!dgwKeys.has(`${teamId}:${event}`)) continue;
      const sample = [...yourIds]
        .map((id) => teamByPlayer.get(id))
        .find((m) => m?.teamId === teamId);
      let rivalCount = 0;
      for (const rival of rivalEntries) {
        const hasClub = rival.ids.some((id) => teamByPlayer.get(id)?.teamId === teamId);
        if (hasClub) rivalCount += 1;
      }
      sharedDgw.push({
        gw: event,
        teamId,
        team: sample?.team ?? `#${teamId}`,
        rivalCount,
      });
    }

    for (const p of yourDefGkp) {
      const list = fxByTeamGw.get(`${p.teamId}:${event}`) ?? [];
      if (list.length === 0) {
        blanks.push({
          gw: event,
          fplId: p.fplId,
          webName: p.name,
          team: p.team,
          position: p.pos,
        });
      }
    }

    const oppCounts = new Map<string, number>();
    for (const p of yourDefGkp) {
      const list = fxByTeamGw.get(`${p.teamId}:${event}`) ?? [];
      for (const fx of list) {
        const oppId = fx.home_team_id === p.teamId ? fx.away_team_id : fx.home_team_id;
        const oppMeta =
          [...teamByPlayer.values()].find((m) => m.teamId === oppId)?.team ?? `#${oppId}`;
        oppCounts.set(oppMeta, (oppCounts.get(oppMeta) ?? 0) + 1);
      }
    }
    for (const [opp, yourCount] of oppCounts) {
      if (yourCount >= 2) sameOpp.push({ gw: event, opp, yourCount });
    }
  }

  return { fromGw, toGw, gws, runs, sharedDgw, blanks, sameOpp };
}

export async function loadMiniLeagueTools(
  entryId: number,
  leagueId: number,
  format: MiniLeagueFormat = "classic",
): Promise<MiniLeagueToolsPayload> {
  const ctx = await loadStandingsContext(entryId, leagueId, format);
  const picksList = await loadSamplePicks(ctx.sampleRows, ctx.gw);
  const historyTargets = ctx.sampleRows;
  const histories = await mapPool(historyTargets, HISTORY_CONCURRENCY, (row) =>
    fetchHistoryPack(row.entry),
  );
  const historyByEntry = new Map<number, HistoryPack>();
  for (const pack of histories) {
    if (pack) historyByEntry.set(pack.entry, pack);
  }

  const gws = rankChartGwWindow(ctx.gw);
  const plotRows = ctx.sampleRows.length ? ctx.sampleRows : pickOverallEntries(ctx, entryId);
  const picksByEntry = new Map(picksList.map((p) => [p.entry, p]));
  const historyMap = new Map<number, HistoryGwTotals[]>();
  for (const row of plotRows) {
    historyMap.set(
      row.entry,
      bestHistoryTotals(
        historyByEntry.get(row.entry) ?? null,
        picksByEntry.get(row.entry),
        row,
        ctx.gw,
      ),
    );
  }
  const rankedGws = gws.filter((event) => event <= ctx.gw);
  const sampleRanks = reconstructSampleRanks(historyMap, rankedGws);

  const miniLeague: MiniLeagueRankSeries[] = plotRows.map((row) => {
    const hist = historyMap.get(row.entry) ?? [];
    const rec = sampleRanks.get(row.entry);
    const points = gws.map((event) => {
      const hit = hist.find((p) => p.event === event);
      return {
        event,
        rank: rec?.get(event) ?? null,
        points: hit?.points ?? null,
        overallRank: hit?.overallRank ?? null,
      };
    });
    return {
      entry: row.entry,
      teamName: row.entryName,
      managerName: row.playerName,
      isYou: row.isYou,
      role: seriesRole(row, ctx, entryId),
      lastRank: row.lastRank,
      rank: row.rank,
      tablePos: row.tablePos,
      points,
    };
  });

  const overall: MiniLeagueOverallSeries[] = plotRows.map((row) => ({
    entry: row.entry,
    teamName: row.entryName,
    managerName: row.playerName,
    isYou: row.isYou,
    role: seriesRole(row, ctx, entryId),
    points: gws.map((event) => ({
      event,
      overallRank:
        historyMap.get(row.entry)?.find((p) => p.event === event)?.overallRank ?? null,
    })),
  }));

  const rankChart: MiniLeagueRankChart = { gw: ctx.gw, gws, miniLeague, overall };

  const chips: MiniLeagueChipRow[] = ctx.sampleRows.map((row) => {
    const pack = historyByEntry.get(row.entry);
    const picks = picksByEntry.get(row.entry);
    let slots = pack ? chipSlotsFromUsed(pack.chips) : emptyChipSlots();
    if (picks?.chip) {
      slots = overlayChipSlots(
        slots,
        chipSlotsFromUsed([{ name: picks.chip, event: picks.event ?? ctx.gw }]),
      );
    }
    return {
      entry: row.entry,
      teamName: row.entryName,
      managerName: row.playerName,
      isYou: row.isYou,
      rank: row.rank,
      tablePos: row.tablePos,
      role: seriesRole(row, ctx, entryId),
      slots,
    };
  });

  const fixtures = await buildFixtureOverlap(
    entryId,
    picksList,
    ctx.fixtureGw,
    plotRows.map((row) => ({
      entry: row.entry,
      teamName: row.entryName,
      isYou: row.isYou,
      role: seriesRole(row, ctx, entryId),
    })),
  );

  return {
    gw: ctx.gw,
    format,
    sample: ctx.sampleRows,
    rankChart,
    chips,
    fixtures,
  };
}

export async function loadMiniLeagueLive(
  entryId: number,
  leagueId: number,
  format: MiniLeagueFormat = "classic",
): Promise<MiniLeagueLivePayload> {
  const ctx = await loadStandingsContext(entryId, leagueId, format);
  const uniqueTargets = pickOverallEntries(ctx, entryId);

  const [{ pointsById, fixtures, status }, picksList] = await Promise.all([
    loadLiveEvent(ctx.fixtureGw),
    mapPool(uniqueTargets, PICKS_CONCURRENCY, async (row) => ({
      entry: row.entry,
      picks: await fetchPicks(row.entry, ctx.gw),
    })),
  ]);

  const allIds = [
    ...new Set(picksList.flatMap((p) => (p.picks?.picks ?? []).map((x) => x.element))),
  ];
  let players: Awaited<ReturnType<typeof loadPlayers>> = new Map();
  if (allIds.length) {
    try {
      players = await loadPlayers(allIds);
    } catch {
      players = new Map();
    }
  }
  const teamByPlayer = new Map<number, number>();
  const metaById = new Map<number, PlayerMeta>();
  for (const [id, row] of players) {
    if (row.team_id != null && Number.isFinite(row.team_id)) {
      teamByPlayer.set(id, Number(row.team_id));
    }
  }
  if (allIds.length) {
    try {
      const extra = await loadMetaFromBootstrap(allIds);
      for (const [id, row] of extra) {
        metaById.set(id, row);
        if (row.team_id != null) teamByPlayer.set(id, row.team_id);
      }
    } catch {
      /* live remaining counts stay unknown */
    }
  }
  const liveTeams = unfinishedTeamIds(fixtures);
  const picksByEntry = new Map(picksList.map((p) => [p.entry, p.picks]));

  const toLive = (row: MiniLeagueStandingRow | null): MiniLeagueLiveManager | null => {
    if (!row) return null;
    const picks = picksByEntry.get(row.entry) ?? null;
    const scored = scoreLivePicks(picks, pointsById, teamByPlayer, liveTeams);
    const capId = picks?.picks.find((x) => x.is_captain)?.element ?? null;
    return {
      entry: row.entry,
      teamName: row.entryName,
      managerName: row.playerName,
      rank: row.rank,
      isYou: row.isYou,
      lastGwPoints: row.eventTotal,
      livePoints: status === "not_started" ? null : scored.livePoints,
      remaining:
        status === "finished"
          ? 0
          : !teamByPlayer.size
            ? status === "not_started"
              ? scored.playing
              : null
            : scored.remaining,
      playing: scored.playing,
      captain: capId != null ? toRef(metaById.get(capId), capId, null) : null,
      chip: chipShort(picks?.active_chip ?? null),
    };
  };

  const sample = uniqueTargets
    .map((row) => toLive(row))
    .filter((row): row is MiniLeagueLiveManager => row != null);
  const remainingVals = sample
    .map((row) => row.remaining)
    .filter((n): n is number => n != null);

  return {
    gw: ctx.fixtureGw,
    status,
    you: toLive(ctx.you),
    above: toLive(ctx.nextRival),
    below: toLive(ctx.below),
    sample,
    avgRemaining: remainingVals.length
      ? Math.round((remainingVals.reduce((a, b) => a + b, 0) / remainingVals.length) * 10) / 10
      : null,
  };
}

export async function loadBeatRival(
  youEntryId: number,
  rivalEntryId: number,
): Promise<MiniLeagueBeatRival> {
  const [gwsResolved, compare, youHist, rivalHist] = await Promise.all([
    resolveMiniLeagueGws(),
    loadRivalCompare(youEntryId, rivalEntryId),
    fetchHistoryPack(youEntryId),
    fetchHistoryPack(rivalEntryId),
  ]);
  const gw = gwsResolved.picksGw;
  const gws = rankChartGwWindow(gw);
  const youPicks = rivalPicksFromResponse(
    youEntryId,
    await fetchPicks(youEntryId, gw),
  );
  const rivalPicks = rivalPicksFromResponse(
    rivalEntryId,
    await fetchPicks(rivalEntryId, gw),
  );
  const swings = gwSwingRows(
    bestHistoryTotals(youHist, youPicks, undefined, gw),
    bestHistoryTotals(rivalHist, rivalPicks, undefined, gw),
    gws,
  );
  const tally = swingTally(swings);
  const youIds = compare.you.picks.map((p) => p.fplId);
  const rivalIds = compare.rival.picks.map((p) => p.fplId);
  const suggestion = suggestBeatTransfer(
    compare.theyHaveYouDont,
    compare.youHaveTheyDont,
  );
  return {
    ...compare,
    squadDiffPct: squadDiffPct(youIds, rivalIds),
    suggestion,
    gws,
    swings,
    youWon: tally.youWon,
    theyWon: tally.theyWon,
    draws: tally.draws,
  };
}

type H2hMatchRaw = {
  id?: number;
  event?: number;
  entry_1?: number | null;
  entry_2?: number | null;
  entry_1_name?: string | null;
  entry_2_name?: string | null;
  entry_1_player_name?: string | null;
  entry_2_player_name?: string | null;
  entry_1_points?: number | null;
  entry_2_points?: number | null;
  is_bye?: boolean;
};

type H2hMatchesApi = {
  has_next?: boolean;
  page?: number;
  results?: H2hMatchRaw[];
};

function matchInvolves(raw: H2hMatchRaw, entryId: number): boolean {
  return Number(raw.entry_1) === entryId || Number(raw.entry_2) === entryId;
}

function h2hLean(youPts: number | null, themPts: number | null): MiniLeagueH2hLean {
  if (youPts == null || themPts == null) return "even";
  if (youPts > themPts) return "you";
  if (themPts > youPts) return "them";
  return "even";
}

async function findH2hMatch(
  leagueId: number,
  entryId: number,
  gw: number,
): Promise<H2hMatchRaw | null> {
  try {
    const tagged = await fplGet<H2hMatchesApi>(
      `/leagues-h2h-matches/league/${leagueId}/?page=1&event=${gw}`,
    );
    const hit =
      (tagged.results ?? []).find(
        (row) => Number(row.event) === gw && matchInvolves(row, entryId),
      ) ??
      (tagged.results ?? []).find((row) => matchInvolves(row, entryId) && Number(row.event) === gw);
    if (hit) return hit;
    if ((tagged.results ?? []).some((row) => Number(row.event) === gw)) {
      return (tagged.results ?? []).find((row) => matchInvolves(row, entryId)) ?? null;
    }
  } catch {
    // Fall through to unfiltered paging.
  }

  for (let page = 1; page <= 8; page++) {
    let pack: H2hMatchesApi;
    try {
      pack = await fplGet<H2hMatchesApi>(
        `/leagues-h2h-matches/league/${leagueId}/?page=${page}`,
      );
    } catch {
      return null;
    }
    const rows = pack.results ?? [];
    const exact = rows.find(
      (row) => Number(row.event) === gw && matchInvolves(row, entryId),
    );
    if (exact) return exact;
    if (!pack.has_next) {
      return rows.find((row) => matchInvolves(row, entryId)) ?? null;
    }
  }
  return null;
}

async function captainRef(
  entryId: number,
  gw: number,
): Promise<MiniLeaguePlayerRef | null> {
  const picks = await fetchPicks(entryId, gw);
  const capId = picks?.picks.find((p) => p.is_captain)?.element ?? null;
  if (capId == null) return null;
  const meta = await loadMetaFromBootstrap([capId]).catch(() => new Map<number, PlayerMeta>());
  return toRef(meta.get(capId), capId, null);
}

function emptyH2hPayload(
  leagueId: number,
  leagueName: string,
  gw: number,
  mode: MiniLeagueH2hPayload["mode"],
): MiniLeagueH2hPayload {
  return { leagueId, leagueName, gw, mode, matchup: null, form: [], youWon: 0, theyWon: 0 };
}

export async function loadH2hMatchup(
  entryId: number,
  leagueId: number,
  format: MiniLeagueFormat = "h2h",
): Promise<MiniLeagueH2hPayload> {
  const [gwsResolved, entry] = await Promise.all([
    resolveMiniLeagueGws(),
    fplGet<FplEntry>(`/entry/${entryId}/`),
  ]);
  const gw = gwsResolved.picksGw;
  const matchGw = gwsResolved.fixtureGw;
  const gws = rankChartGwWindow(gw);

  if (format === "classic") {
    const ctx = await loadStandingsContext(entryId, leagueId, "classic");
    const leagueName =
      entry.leagues?.classic?.find((l) => l.id === leagueId)?.name ?? `League ${leagueId}`;
    const opp = ctx.nextRival ?? (ctx.leader && !ctx.leader.isYou ? ctx.leader : ctx.below);
    if (!opp) {
      return emptyH2hPayload(leagueId, leagueName, gw, "race");
    }
    const [youHist, oppHist, youCap, oppCap] = await Promise.all([
      fetchHistoryPack(entryId),
      fetchHistoryPack(opp.entry),
      captainRef(entryId, gw),
      captainRef(opp.entry, gw),
    ]);
    const form = gwSwingRows(
      bestHistoryTotals(youHist, undefined, ctx.you ?? undefined, gw),
      bestHistoryTotals(oppHist, undefined, opp, gw),
      gws,
    );
    const tally = swingTally(form);
    const youPoints = ctx.you?.eventTotal ?? null;
    const themPoints = opp.eventTotal;
    const youSide: MiniLeagueH2hSide = {
      entry: entryId,
      teamName: ctx.you?.entryName ?? entry.name,
      managerName: ctx.you?.playerName ?? managerNameOf(entry),
      points: youPoints,
      chips: youHist ? chipSlotsFromUsed(youHist.chips) : emptyChipSlots(),
      captain: youCap,
    };
    const oppSide: MiniLeagueH2hSide = {
      entry: opp.entry,
      teamName: opp.entryName,
      managerName: opp.playerName,
      points: themPoints,
      chips: oppHist ? chipSlotsFromUsed(oppHist.chips) : emptyChipSlots(),
      captain: oppCap,
    };
    return {
      leagueId,
      leagueName,
      gw,
      mode: "race",
      matchup: {
        gw,
        isBye: false,
        you: youSide,
        opponent: oppSide,
        lean: h2hLean(youPoints, themPoints),
      },
      form,
      youWon: tally.youWon,
      theyWon: tally.theyWon,
    };
  }

  const league = entry.leagues?.h2h?.find((l) => l.id === leagueId);
  const leagueName = league?.name ?? `League ${leagueId}`;
  const match = await findH2hMatch(leagueId, entryId, matchGw);

  if (!match) {
    return emptyH2hPayload(leagueId, leagueName, gw, "h2h");
  }

  const youAre1 = Number(match.entry_1) === entryId;
  const oppEntry = youAre1 ? Number(match.entry_2) : Number(match.entry_1);
  const isBye = Boolean(match.is_bye) || !Number.isFinite(oppEntry) || oppEntry <= 0;

  const youPts = youAre1 ? Number(match.entry_1_points) : Number(match.entry_2_points);
  const themPts = youAre1 ? Number(match.entry_2_points) : Number(match.entry_1_points);
  const youPoints = Number.isFinite(youPts) ? youPts : null;
  const themPoints = Number.isFinite(themPts) ? themPts : null;

  const [youHist, oppHist, youCap, oppCap] = await Promise.all([
    fetchHistoryPack(entryId),
    !isBye && Number.isFinite(oppEntry) ? fetchHistoryPack(oppEntry) : Promise.resolve(null),
    captainRef(entryId, gw),
    !isBye && Number.isFinite(oppEntry) ? captainRef(oppEntry, gw) : Promise.resolve(null),
  ]);
  const form = isBye
    ? []
    : gwSwingRows(
        bestHistoryTotals(youHist, undefined, undefined, gw),
        bestHistoryTotals(oppHist, undefined, undefined, gw),
        gws,
      );
  const tally = swingTally(form);

  const youName = youAre1
    ? String(match.entry_1_name ?? entry.name)
    : String(match.entry_2_name ?? entry.name);
  const youManager = youAre1
    ? String(match.entry_1_player_name ?? managerNameOf(entry))
    : String(match.entry_2_player_name ?? managerNameOf(entry));

  return {
    leagueId,
    leagueName,
    gw: Number(match.event) || gw,
    mode: "h2h",
    matchup: {
      gw: Number(match.event) || gw,
      isBye,
      you: {
        entry: entryId,
        teamName: youName || entry.name,
        managerName: youManager,
        points: youPoints,
        chips: youHist ? chipSlotsFromUsed(youHist.chips) : emptyChipSlots(),
        captain: youCap,
      },
      opponent: isBye
        ? null
        : {
            entry: oppEntry,
            teamName:
              (youAre1 ? match.entry_2_name : match.entry_1_name)?.trim() ||
              `#${oppEntry}`,
            managerName:
              (youAre1 ? match.entry_2_player_name : match.entry_1_player_name)?.trim() ||
              "—",
            points: themPoints,
            chips: oppHist ? chipSlotsFromUsed(oppHist.chips) : emptyChipSlots(),
            captain: oppCap,
          },
      lean: isBye ? "you" : h2hLean(youPoints, themPoints),
    },
    form,
    youWon: tally.youWon,
    theyWon: tally.theyWon,
  };
}

type FplTransferRow = {
  element_in?: number;
  element_out?: number;
  event?: number;
};

async function fetchTransfers(entryId: number): Promise<FplTransferRow[]> {
  try {
    const rows = await fplGet<FplTransferRow[]>(`/entry/${entryId}/transfers/`);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function loadLeagueMoves(
  entryId: number,
  leagueId: number,
  format: MiniLeagueFormat = "classic",
): Promise<MiniLeagueMovesPayload> {
  const ctx = await loadStandingsContext(entryId, leagueId, format);
  const targets = ctx.sampleRows;
  const packs = await mapPool(targets, PICKS_CONCURRENCY, async (row) => {
    const all = await fetchTransfers(row.entry);
    const thisGw = all.filter((t) => Number(t.event) === ctx.gw);
    const prevGw = all.filter((t) => Number(t.event) === ctx.gw - 1);
    return { row, thisGw, prevGw };
  });
  const usePrev = packs.every((p) => p.thisGw.length === 0) && ctx.gw > 1;
  const eventUsed = usePrev ? ctx.gw - 1 : ctx.gw;
  const withMoves = packs.map((p) => ({
    row: p.row,
    transfers: usePrev ? p.prevGw : p.thisGw,
  }));

  const allIds: number[] = [];
  for (const pack of withMoves) {
    for (const t of pack.transfers) {
      const inn = Number(t.element_in);
      const out = Number(t.element_out);
      if (Number.isFinite(inn) && inn > 0) allIds.push(inn);
      if (Number.isFinite(out) && out > 0) allIds.push(out);
    }
  }
  const unique = [...new Set(allIds)];
  const { metaById, xpById } = unique.length
    ? await loadPlayerBundle(unique)
    : { metaById: new Map<number, PlayerMeta>(), xpById: new Map<number, number>() };

  type Agg = { count: number; youDid: boolean; managers: string[]; fplId: number };
  const inAgg = new Map<number, Agg>();
  const outAgg = new Map<number, Agg>();
  const bump = (map: Map<number, Agg>, fplId: number, isYou: boolean, teamName: string) => {
    const cur = map.get(fplId) ?? { count: 0, youDid: false, managers: [], fplId };
    cur.count += 1;
    if (isYou) cur.youDid = true;
    if (cur.managers.length < 4) cur.managers.push(teamName);
    map.set(fplId, cur);
  };

  const yourMoves: MiniLeagueManagerMove[] = [];
  let moved = 0;
  for (const pack of withMoves) {
    if (pack.transfers.length) moved += 1;
    for (const t of pack.transfers) {
      const inn = Number(t.element_in);
      const out = Number(t.element_out);
      if (Number.isFinite(inn) && inn > 0) bump(inAgg, inn, pack.row.isYou, pack.row.entryName);
      if (Number.isFinite(out) && out > 0) bump(outAgg, out, pack.row.isYou, pack.row.entryName);
      if (pack.row.isYou && Number.isFinite(inn) && Number.isFinite(out)) {
        yourMoves.push({
          entry: pack.row.entry,
          teamName: pack.row.entryName,
          isYou: true,
          inn: toRef(metaById.get(inn), inn, xpById.get(inn) ?? null),
          out: toRef(metaById.get(out), out, xpById.get(out) ?? null),
        });
      }
    }
  }

  const toBoard = (map: Map<number, Agg>): MiniLeagueMoveBoardRow[] =>
    [...map.values()]
      .sort((a, b) => b.count - a.count || a.fplId - b.fplId)
      .slice(0, 8)
      .map((row) => ({
        ...toRef(metaById.get(row.fplId), row.fplId, xpById.get(row.fplId) ?? null),
        count: row.count,
        youDid: row.youDid,
        managers: row.managers,
      }));

  return {
    gw: eventUsed,
    sampled: targets.length,
    moved,
    broughtIn: toBoard(inAgg),
    sold: toBoard(outAgg),
    yourMoves,
  };
}
