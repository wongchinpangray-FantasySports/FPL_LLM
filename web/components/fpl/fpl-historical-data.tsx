"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { FplHistoricalPlayerModal } from "@/components/fpl/fpl-historical-player-modal";
import {
  HISTORICAL_SEASON_ALL,
  type HistoricalMeta,
  type HistoricalPlayerDetail,
  type HistoricalPlayerRow,
  type HistoricalPosition,
  type HistoricalQueryResult,
  type HistoricalSortField,
} from "@/lib/fpl/historical-data";

type Labels = {
  season: string;
  seasonAll: string;
  gwFrom: string;
  gwTo: string;
  position: string;
  positionAll: string;
  team: string;
  teamAll: string;
  name: string;
  namePlaceholder: string;
  minMinutes: string;
  minAppearances: string;
  sortBy: string;
  sortDir: string;
  sortAsc: string;
  sortDesc: string;
  apply: string;
  reset: string;
  loading: string;
  noResults: string;
  results: string;
  showing: string;
  prev: string;
  next: string;
  openProfile: string;
  note: string;
  colPlayer: string;
  colTeam: string;
  colPos: string;
  colApps: string;
  colMins: string;
  colPts: string;
  colGoals: string;
  colAssists: string;
  colCs: string;
  colXg: string;
  colXa: string;
  colIct: string;
  colPts90: string;
  colXgi90: string;
  sortTotalPoints: string;
  sortGoals: string;
  sortAssists: string;
  sortXg: string;
  sortXa: string;
  sortCs: string;
  sortMinutes: string;
  sortBonus: string;
  sortIct: string;
  sortBps: string;
  sortDefcon: string;
  sortPts90: string;
  sortApps: string;
  detailClose: string;
  detailLoading: string;
  detailError: string;
  detailSeasonRange: string;
  detailSummaryTitle: string;
  detailGwBreakdownTitle: string;
  detailNoGameweeks: string;
  detailViewCurrentProfile: string;
  detailColGw: string;
  detailColBps: string;
  detailColDefcon: string;
  detailColOpponent: string;
  detailDgw: string;
  detailBgw: string;
};

const POSITIONS: (HistoricalPosition | "ALL")[] = [
  "ALL",
  "GKP",
  "DEF",
  "MID",
  "FWD",
];

const SORT_OPTIONS: HistoricalSortField[] = [
  "total_points",
  "points_per90",
  "goals_scored",
  "assists",
  "expected_goals",
  "expected_assists",
  "clean_sheets",
  "minutes",
  "appearances",
  "bonus",
  "ict_index",
  "bps",
  "defensive_contribution",
];

type Filters = {
  season: string;
  gwFrom: number;
  gwTo: number;
  position: HistoricalPosition | "ALL";
  teamId: number | "ALL";
  name: string;
  minMinutes: string;
  minAppearances: string;
  sortBy: HistoricalSortField;
  sortDir: "asc" | "desc";
};

function sortLabel(sortBy: HistoricalSortField, labels: Labels): string {
  const map: Record<HistoricalSortField, string> = {
    total_points: labels.sortTotalPoints,
    goals_scored: labels.sortGoals,
    assists: labels.sortAssists,
    expected_goals: labels.sortXg,
    expected_assists: labels.sortXa,
    clean_sheets: labels.sortCs,
    minutes: labels.sortMinutes,
    bonus: labels.sortBonus,
    ict_index: labels.sortIct,
    bps: labels.sortBps,
    defensive_contribution: labels.sortDefcon,
    points_per90: labels.sortPts90,
    appearances: labels.sortApps,
  };
  return map[sortBy];
}

function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toFixed(digits);
}

function gwBoundsForSeason(
  season: string,
  meta: HistoricalMeta,
): { min: number; max: number } {
  if (season === HISTORICAL_SEASON_ALL) {
    const bounds = Object.values(meta.gwBounds);
    if (!bounds.length) return { min: 1, max: 38 };
    return bounds.reduce(
      (acc, b) => ({
        min: Math.min(acc.min, b.min),
        max: Math.max(acc.max, b.max),
      }),
      { min: bounds[0]!.min, max: bounds[0]!.max },
    );
  }
  return meta.gwBounds[season] ?? { min: 1, max: 38 };
}

function seasonDisplay(season: string): string {
  const y = Number(season);
  if (!Number.isFinite(y)) return season;
  return `${season}/${String(y + 1).slice(-2)}`;
}

function seasonSummaryLabel(season: string, labels: Labels): string {
  if (season === HISTORICAL_SEASON_ALL) return labels.seasonAll;
  const y = Number(season);
  if (!Number.isFinite(y)) return season;
  return `${season}/${String(y + 1).slice(-2)}`;
}

function buildQuery(filters: Filters, offset: number, limit: number): string {
  const p = new URLSearchParams();
  p.set("season", filters.season);
  p.set("gwFrom", String(filters.gwFrom));
  p.set("gwTo", String(filters.gwTo));
  if (filters.position !== "ALL") p.set("position", filters.position);
  if (filters.teamId !== "ALL") p.set("teamId", String(filters.teamId));
  if (filters.name.trim().length >= 2) p.set("name", filters.name.trim());
  if (filters.minMinutes.trim()) p.set("minMinutes", filters.minMinutes.trim());
  if (filters.minAppearances.trim()) {
    p.set("minAppearances", filters.minAppearances.trim());
  }
  p.set("sortBy", filters.sortBy);
  p.set("sortDir", filters.sortDir);
  p.set("limit", String(limit));
  p.set("offset", String(offset));
  return p.toString();
}

function defaultFilters(meta: HistoricalMeta): Filters {
  const season = meta.activeSeason;
  const bounds = meta.gwBounds[season] ?? { min: 1, max: 38 };
  return {
    season,
    gwFrom: bounds.min,
    gwTo: bounds.max,
    position: "ALL",
    teamId: "ALL",
    name: "",
    minMinutes: "",
    minAppearances: "1",
    sortBy: "total_points",
    sortDir: "desc",
  };
}

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent";

function emptyMeta(): HistoricalMeta {
  return {
    seasons: ["2025"],
    activeSeason: "2025",
    teams: [],
    gwBounds: { "2025": { min: 1, max: 38 } },
  };
}

export function FplHistoricalData({
  meta: initialMeta,
  labels,
}: {
  meta: HistoricalMeta | null;
  labels: Labels;
}) {
  const [meta, setMeta] = useState<HistoricalMeta>(initialMeta ?? emptyMeta());
  const [metaReady, setMetaReady] = useState(Boolean(initialMeta));
  const [filters, setFilters] = useState<Filters>(() =>
    defaultFilters(initialMeta ?? emptyMeta()),
  );
  const [applied, setApplied] = useState<Filters>(() =>
    defaultFilters(initialMeta ?? emptyMeta()),
  );
  const [result, setResult] = useState<HistoricalQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoricalPlayerDetail | null>(null);
  const limit = 50;

  useEffect(() => {
    if (initialMeta) {
      setMeta(initialMeta);
      setMetaReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/fpl/historical?meta=1");
        const data = (await res.json()) as HistoricalMeta & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load meta");
        if (!cancelled) {
          setMeta(data);
          const nextFilters = defaultFilters(data);
          setFilters(nextFilters);
          setApplied(nextFilters);
        }
      } catch {
        if (!cancelled) {
          const fallback = emptyMeta();
          setMeta(fallback);
          const nextFilters = defaultFilters(fallback);
          setFilters(nextFilters);
          setApplied(nextFilters);
        }
      } finally {
        if (!cancelled) setMetaReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialMeta]);

  const gwBounds = gwBoundsForSeason(filters.season, meta);

  const fetchData = useCallback(
    async (active: Filters, pageOffset: number) => {
      setLoading(true);
      try {
        const qs = buildQuery(active, pageOffset, limit);
        const res = await fetch(`/api/fpl/historical?${qs}`);
        const data = (await res.json()) as HistoricalQueryResult & {
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Query failed");
        setResult(data);
      } catch {
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    if (!metaReady) return;
    void fetchData(applied, offset);
  }, [applied, offset, fetchData, metaReady]);

  if (!metaReady) {
    return (
      <p className="text-sm text-muted-foreground">{labels.loading}</p>
    );
  }

  function onSeasonChange(season: string) {
    const bounds = gwBoundsForSeason(season, meta);
    setFilters((f) => ({
      ...f,
      season,
      gwFrom: bounds.min,
      gwTo: bounds.max,
    }));
  }

  function applyFilters() {
    setOffset(0);
    setApplied({ ...filters });
  }

  function resetFilters() {
    const next = defaultFilters(meta);
    setFilters(next);
    setApplied(next);
    setOffset(0);
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / limit)) : 1;
  const currentPage = Math.floor(offset / limit) + 1;

  const summary = useMemo(() => {
    if (!result) return "";
    return labels.results
      .replace("{season}", seasonSummaryLabel(applied.season, labels))
      .replace("{from}", String(result.gwFrom))
      .replace("{to}", String(result.gwTo))
      .replace("{count}", String(result.total));
  }, [result, applied, labels]);

  const openPlayerDetail = useCallback(
    async (row: HistoricalPlayerRow) => {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailError(null);
      setDetail(null);
      try {
        const p = new URLSearchParams({
          playerId: String(row.fpl_id),
          season: applied.season,
          gwFrom: String(applied.gwFrom),
          gwTo: String(applied.gwTo),
        });
        const res = await fetch(`/api/fpl/historical/player?${p.toString()}`);
        const data = (await res.json()) as HistoricalPlayerDetail & {
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? labels.detailError);
        setDetail(data);
      } catch (e) {
        setDetailError(e instanceof Error ? e.message : labels.detailError);
      } finally {
        setDetailLoading(false);
      }
    },
    [applied, labels.detailError],
  );

  const closePlayerDetail = useCallback(() => {
    setDetailOpen(false);
    setDetail(null);
    setDetailError(null);
  }, []);

  const modalLabels = useMemo(
    () => ({
      close: labels.detailClose,
      loading: labels.detailLoading,
      error: labels.detailError,
      seasonRange: labels.detailSeasonRange,
      summaryTitle: labels.detailSummaryTitle,
      gwBreakdownTitle: labels.detailGwBreakdownTitle,
      noGameweeks: labels.detailNoGameweeks,
      viewCurrentProfile: labels.detailViewCurrentProfile,
      colGw: labels.detailColGw,
      colMins: labels.colMins,
      colPts: labels.colPts,
      colGoals: labels.colGoals,
      colAssists: labels.colAssists,
      colCs: labels.colCs,
      colBonus: labels.sortBonus,
      colXg: labels.colXg,
      colXa: labels.colXa,
      colIct: labels.colIct,
      colApps: labels.colApps,
      colBps: labels.detailColBps,
      colDefcon: labels.detailColDefcon,
      colPts90: labels.colPts90,
      colOpponent: labels.detailColOpponent,
      dgw: labels.detailDgw,
      bgw: labels.detailBgw,
    }),
    [labels],
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{labels.note}</p>

      <section className="rounded-xl border border-border bg-card/50 p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label={labels.season}>
            <select
              value={filters.season}
              onChange={(e) => onSeasonChange(e.target.value)}
              className={inputClass}
            >
              <option value={HISTORICAL_SEASON_ALL}>{labels.seasonAll}</option>
              {meta.seasons.map((s) => (
                <option key={s} value={s}>
                  {seasonDisplay(s)}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label={labels.gwFrom}>
            <input
              type="number"
              min={gwBounds.min}
              max={gwBounds.max}
              value={filters.gwFrom}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  gwFrom: Math.max(
                    gwBounds.min,
                    Math.min(gwBounds.max, Number(e.target.value) || gwBounds.min),
                  ),
                }))
              }
              className={inputClass}
            />
          </FilterField>

          <FilterField label={labels.gwTo}>
            <input
              type="number"
              min={gwBounds.min}
              max={gwBounds.max}
              value={filters.gwTo}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  gwTo: Math.max(
                    gwBounds.min,
                    Math.min(gwBounds.max, Number(e.target.value) || gwBounds.max),
                  ),
                }))
              }
              className={inputClass}
            />
          </FilterField>

          <FilterField label={labels.position}>
            <select
              value={filters.position}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  position: e.target.value as Filters["position"],
                }))
              }
              className={inputClass}
            >
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos === "ALL" ? labels.positionAll : pos}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label={labels.team}>
            <select
              value={filters.teamId === "ALL" ? "ALL" : String(filters.teamId)}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  teamId:
                    e.target.value === "ALL"
                      ? "ALL"
                      : Number(e.target.value),
                }))
              }
              className={inputClass}
            >
              <option value="ALL">{labels.teamAll}</option>
              {meta.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label={labels.name}>
            <input
              type="search"
              value={filters.name}
              onChange={(e) =>
                setFilters((f) => ({ ...f, name: e.target.value }))
              }
              placeholder={labels.namePlaceholder}
              className={inputClass}
            />
          </FilterField>

          <FilterField label={labels.minMinutes}>
            <input
              type="number"
              min={0}
              value={filters.minMinutes}
              onChange={(e) =>
                setFilters((f) => ({ ...f, minMinutes: e.target.value }))
              }
              placeholder="0"
              className={inputClass}
            />
          </FilterField>

          <FilterField label={labels.minAppearances}>
            <input
              type="number"
              min={0}
              value={filters.minAppearances}
              onChange={(e) =>
                setFilters((f) => ({ ...f, minAppearances: e.target.value }))
              }
              placeholder="1"
              className={inputClass}
            />
          </FilterField>

          <FilterField label={labels.sortBy}>
            <select
              value={filters.sortBy}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sortBy: e.target.value as HistoricalSortField,
                }))
              }
              className={inputClass}
            >
              {SORT_OPTIONS.map((sort) => (
                <option key={sort} value={sort}>
                  {sortLabel(sort, labels)}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label={labels.sortDir}>
            <select
              value={filters.sortDir}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sortDir: e.target.value as "asc" | "desc",
                }))
              }
              className={inputClass}
            >
              <option value="desc">{labels.sortDesc}</option>
              <option value="asc">{labels.sortAsc}</option>
            </select>
          </FilterField>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {labels.apply}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            {labels.reset}
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? labels.loading : summary || labels.noResults}
        </p>
        {result && result.total > limit ? (
          <p className="text-xs text-muted-foreground">
            {labels.showing
              .replace("{from}", String(offset + 1))
              .replace("{to}", String(Math.min(offset + limit, result.total)))
              .replace("{total}", String(result.total))}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">{labels.colPlayer}</th>
              <th className="px-3 py-2.5 font-medium">{labels.colTeam}</th>
              <th className="px-3 py-2.5 font-medium">{labels.colPos}</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">{labels.colApps}</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">{labels.colMins}</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">{labels.colPts}</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">{labels.colGoals}</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">{labels.colAssists}</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">{labels.colCs}</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">{labels.colXg}</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">{labels.colXa}</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">{labels.colIct}</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">{labels.colPts90}</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">{labels.colXgi90}</th>
              <th className="px-3 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={15} className="px-3 py-8 text-center text-muted-foreground">
                  {labels.loading}
                </td>
              </tr>
            ) : !result?.rows.length ? (
              <tr>
                <td colSpan={15} className="px-3 py-8 text-center text-muted-foreground">
                  {labels.noResults}
                </td>
              </tr>
            ) : (
              result.rows.map((row) => (
                <HistoricalRow
                  key={row.fpl_id}
                  row={row}
                  labels={labels}
                  onOpenDetail={() => void openPlayerDetail(row)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {result && result.total > limit ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={offset <= 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className={cn(
              "rounded-lg border border-border px-3 py-1.5 text-sm",
              offset <= 0
                ? "cursor-not-allowed opacity-40"
                : "hover:bg-muted",
            )}
          >
            {labels.prev}
          </button>
          <span className="text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={offset + limit >= result.total}
            onClick={() => setOffset((o) => o + limit)}
            className={cn(
              "rounded-lg border border-border px-3 py-1.5 text-sm",
              offset + limit >= result.total
                ? "cursor-not-allowed opacity-40"
                : "hover:bg-muted",
            )}
          >
            {labels.next}
          </button>
        </div>
      ) : null}

      <FplHistoricalPlayerModal
        open={detailOpen}
        loading={detailLoading}
        error={detailError}
        detail={detail}
        labels={modalLabels}
        onClose={closePlayerDetail}
      />
    </div>
  );
}

function HistoricalRow({
  row,
  labels,
  onOpenDetail,
}: {
  row: HistoricalPlayerRow;
  labels: Labels;
  onOpenDetail: () => void;
}) {
  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-muted/30">
      <td className="px-3 py-2.5 font-medium text-foreground">
        {row.web_name || row.name}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{row.team}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{row.position}</td>
      <td className="px-3 py-2.5 tabular-nums">{row.appearances}</td>
      <td className="px-3 py-2.5 tabular-nums">{row.minutes}</td>
      <td className="px-3 py-2.5 tabular-nums font-semibold text-foreground">
        {row.total_points}
      </td>
      <td className="px-3 py-2.5 tabular-nums">{row.goals_scored}</td>
      <td className="px-3 py-2.5 tabular-nums">{row.assists}</td>
      <td className="px-3 py-2.5 tabular-nums">{row.clean_sheets}</td>
      <td className="px-3 py-2.5 tabular-nums">{fmtNum(row.expected_goals, 2)}</td>
      <td className="px-3 py-2.5 tabular-nums">{fmtNum(row.expected_assists, 2)}</td>
      <td className="px-3 py-2.5 tabular-nums">{fmtNum(row.ict_index, 1)}</td>
      <td className="px-3 py-2.5 tabular-nums">{fmtNum(row.points_per90, 2)}</td>
      <td className="px-3 py-2.5 tabular-nums">{fmtNum(row.xgi_per90, 2)}</td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={onOpenDetail}
          className="text-xs text-brand-accent hover:underline"
        >
          {labels.openProfile}
        </button>
      </td>
    </tr>
  );
}
