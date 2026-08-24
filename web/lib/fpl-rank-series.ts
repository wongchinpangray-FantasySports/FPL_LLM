import type { FplHistoryCurrentRow } from "@/lib/fpl";

export type RankHistoryPoint = {
  event: number;
  overall_rank: number;
  average_rank: number | null;
};

/** Mid-table rank ≈ half the field. */
export function midpointRank(totalPlayers: number | null | undefined): number | null {
  if (totalPlayers == null || !Number.isFinite(totalPlayers) || totalPlayers <= 0) {
    return null;
  }
  return Math.max(1, Math.round(totalPlayers / 2));
}

/**
 * FPL `percentile_rank` is 1–100, lower is better.
 * Field size ≈ overall_rank / (percentile / 100), so the median manager
 * sits near overall_rank * 50 / percentile.
 */
export function estimateAverageRank(
  overallRank: number,
  percentileRank: number | null | undefined,
  fallbackAverage: number | null,
): number | null {
  if (
    Number.isFinite(overallRank) &&
    overallRank > 0 &&
    percentileRank != null &&
    Number.isFinite(percentileRank) &&
    percentileRank > 0 &&
    percentileRank <= 100
  ) {
    return Math.max(1, Math.round((overallRank * 50) / percentileRank));
  }
  return fallbackAverage;
}

export function historyToRankSeries(
  current: FplHistoryCurrentRow[] | undefined,
  fallbackAverage: number | null,
): RankHistoryPoint[] {
  return (current ?? [])
    .filter((row) => Number.isFinite(row.overall_rank) && row.overall_rank > 0)
    .map((row) => ({
      event: row.event,
      overall_rank: row.overall_rank,
      average_rank: estimateAverageRank(
        row.overall_rank,
        row.percentile_rank,
        fallbackAverage,
      ),
    }));
}

/** Prefer the live overall rank on the current GW so the chart matches the headline number. */
export function applyLiveOverallRank(
  series: RankHistoryPoint[],
  live: {
    event: number | null | undefined;
    overall_rank: number | null | undefined;
  },
  fallbackAverage: number | null,
): RankHistoryPoint[] {
  const rank = live.overall_rank;
  if (rank == null || !Number.isFinite(rank) || rank <= 0) return series;
  const gw = live.event ?? series.at(-1)?.event ?? null;
  if (gw == null) {
    return [{ event: 1, overall_rank: rank, average_rank: fallbackAverage }];
  }
  const next = series.map((p) => ({ ...p }));
  const idx = next.findIndex((p) => p.event === gw);
  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      overall_rank: rank,
      average_rank: next[idx].average_rank ?? fallbackAverage,
    };
    return next;
  }
  next.push({
    event: gw,
    overall_rank: rank,
    average_rank: next.at(-1)?.average_rank ?? fallbackAverage,
  });
  next.sort((a, b) => a.event - b.event);
  return next;
}
