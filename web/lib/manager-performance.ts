import { fplGet } from "@/lib/fpl";
import type {
  FplEntry,
  FplHistoryCurrentRow,
  FplHistoryPastSeason,
  FplHistoryResponse,
} from "@/lib/fpl";

const OVERALL_LEAGUE_ID = 314;
/** Overall standings pages whose midpoint ~ overall rank 10k / 100k (50 managers per page). */
const STANDINGS_PAGE_10K_BAND = 200;
const STANDINGS_PAGE_100K_BAND = 2000;

interface StandingsApi {
  standings?: {
    results?: Array<{
      rank: number;
      entry: number;
      total: number;
    }>;
  };
}

interface BootstrapStatic {
  events?: Array<{
    id: number;
    average_entry_score?: number;
  }>;
}

function pointsByEvent(current: FplHistoryCurrentRow[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const row of current) {
    m.set(row.event, row.points);
  }
  return m;
}

/** Pick a stable midfield manager from a standings page as a benchmark sample. */
function proxyEntryFromStandingsPage(data: StandingsApi): {
  entryId: number;
  rankLabel: number;
} | null {
  const results = data.standings?.results ?? [];
  if (!results.length) return null;
  const mid = results[Math.floor(results.length / 2)]!;
  return { entryId: mid.entry, rankLabel: mid.rank };
}

export type ManagerGwCompareRow = {
  event: number;
  pointsYou: number;
  pointsGlobalAvg: number | null;
  /** Single Overall-league manager near ~10k rank — not the exact cohort average. */
  pointsTop10kSample: number | null;
  pointsTop100kSample: number | null;
};

export type ManagerPerformancePayload = {
  entry: Pick<
    FplEntry,
    | "id"
    | "name"
    | "player_first_name"
    | "player_last_name"
    | "summary_overall_points"
    | "summary_overall_rank"
    | "current_event"
  >;
  /** Current season gameweeks, chronological. */
  currentSeason: FplHistoryCurrentRow[];
  pastSeasons: FplHistoryPastSeason[];
  compareByGw: ManagerGwCompareRow[];
  benchmarksMeta: {
    top10kSampleEntryId: number | null;
    top10kSampleRank: number | null;
    top100kSampleEntryId: number | null;
    top100kSampleRank: number | null;
  };
};

export async function loadManagerPerformance(
  entryId: number,
): Promise<ManagerPerformancePayload> {
  const [
    entry,
    history,
    bootstrap,
    standings10kPage,
    standings100kPage,
  ] = await Promise.all([
    fplGet<FplEntry>(`/entry/${entryId}/`),
    fplGet<FplHistoryResponse>(`/entry/${entryId}/history/`),
    fplGet<BootstrapStatic>(`/bootstrap-static/`),
    fplGet<StandingsApi>(
      `/leagues-classic/${OVERALL_LEAGUE_ID}/standings/?page_standings=${STANDINGS_PAGE_10K_BAND}`,
    ).catch(() => ({}) as StandingsApi),
    fplGet<StandingsApi>(
      `/leagues-classic/${OVERALL_LEAGUE_ID}/standings/?page_standings=${STANDINGS_PAGE_100K_BAND}`,
    ).catch(() => ({}) as StandingsApi),
  ]);

  const avgByEvent = new Map<number, number>();
  for (const e of bootstrap.events ?? []) {
    if (typeof e.average_entry_score === "number") {
      avgByEvent.set(e.id, e.average_entry_score);
    }
  }

  const proxy10 = proxyEntryFromStandingsPage(standings10kPage);
  const proxy100 = proxyEntryFromStandingsPage(standings100kPage);

  const [hist10, hist100] = await Promise.all([
    proxy10
      ? fplGet<FplHistoryResponse>(`/entry/${proxy10.entryId}/history/`).catch(
          () => null,
        )
      : Promise.resolve(null),
    proxy100
      ? fplGet<FplHistoryResponse>(`/entry/${proxy100.entryId}/history/`).catch(
          () => null,
        )
      : Promise.resolve(null),
  ]);

  const map10 = hist10 ? pointsByEvent(hist10.current) : new Map();
  const map100 = hist100 ? pointsByEvent(hist100.current) : new Map();

  const currentSeason = [...history.current].sort((a, b) => a.event - b.event);

  const compareByGw: ManagerGwCompareRow[] = currentSeason.map((r) => ({
    event: r.event,
    pointsYou: r.points,
    pointsGlobalAvg: avgByEvent.get(r.event) ?? null,
    pointsTop10kSample: map10.get(r.event) ?? null,
    pointsTop100kSample: map100.get(r.event) ?? null,
  }));

  return {
    entry: {
      id: entry.id,
      name: entry.name,
      player_first_name: entry.player_first_name,
      player_last_name: entry.player_last_name,
      summary_overall_points: entry.summary_overall_points,
      summary_overall_rank: entry.summary_overall_rank,
      current_event: entry.current_event,
    },
    currentSeason,
    pastSeasons: [...history.past].reverse(),
    compareByGw,
    benchmarksMeta: {
      top10kSampleEntryId: proxy10?.entryId ?? null,
      top10kSampleRank: proxy10?.rankLabel ?? null,
      top100kSampleEntryId: proxy100?.entryId ?? null,
      top100kSampleRank: proxy100?.rankLabel ?? null,
    },
  };
}
