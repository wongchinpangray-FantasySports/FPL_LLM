"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { PriceForecastRow, PriceForecastStatus } from "@/lib/fpl/insights/price-forecast";
import {
  InsightsSortableTh,
  sortInsightRows,
  useInsightsTableSort,
} from "@/components/fpl/insights/insights-table-sort";

type Tab = "likely" | "rise" | "fall" | "all";
type SortKey =
  | "player"
  | "team"
  | "pos"
  | "price"
  | "own"
  | "net"
  | "progress";

const TAB_SORT: Record<Tab, { key: SortKey; dir: "asc" | "desc" }> = {
  likely: { key: "progress", dir: "desc" },
  rise: { key: "progress", dir: "desc" },
  fall: { key: "progress", dir: "asc" },
  all: { key: "progress", dir: "desc" },
};

function fmtPrice(v: number): string {
  return `£${v.toFixed(1)}m`;
}

function fmtInt(v: number): string {
  const abs = Math.abs(v);
  const body =
    abs >= 1_000_000
      ? `${(abs / 1_000_000).toFixed(2)}m`
      : abs >= 1000
        ? `${(abs / 1000).toFixed(0)}k`
        : String(abs);
  if (v > 0) return `+${body}`;
  if (v < 0) return `-${body}`;
  return "0";
}

function fmtPct(progress: number): string {
  return `${Math.round(Math.abs(progress) * 100)}%`;
}

function deltaClass(v: number): string {
  if (Math.abs(v) < 0.05) return "text-muted-foreground";
  return v > 0 ? "text-emerald-400" : "text-red-400";
}

function statusTone(status: PriceForecastStatus): string {
  switch (status) {
    case "likely_rise":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "watch_rise":
      return "border-emerald-500/20 bg-emerald-500/5 text-emerald-300/80";
    case "likely_fall":
      return "border-red-500/30 bg-red-500/10 text-red-400";
    case "watch_fall":
      return "border-red-500/20 bg-red-500/5 text-red-300/80";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function forecastSortValue(
  row: PriceForecastRow,
  key: SortKey,
): string | number | null {
  switch (key) {
    case "player":
      return row.web_name;
    case "team":
      return row.team;
    case "pos":
      return row.position;
    case "price":
      return row.current_price;
    case "own":
      return row.selected_by_percent;
    case "net":
      return row.net_transfers;
    case "progress":
    default:
      return row.progress;
  }
}

export function PriceForecastPanel({
  rows,
  gw,
  source,
  likelyRiseCount,
  likelyFallCount,
  labels,
}: {
  rows: PriceForecastRow[];
  gw: number;
  source: "live" | "db";
  likelyRiseCount: number;
  likelyFallCount: number;
  labels: {
    intro: string;
    sourceLive: string;
    sourceDb: string;
    summaryRise: string;
    summaryFall: string;
    tabLikely: string;
    tabRise: string;
    tabFall: string;
    tabAll: string;
    filterPos: string;
    posAll: string;
    posGkp: string;
    posDef: string;
    posMid: string;
    posFwd: string;
    colPlayer: string;
    colTeam: string;
    colPos: string;
    colPrice: string;
    colOwn: string;
    colNet: string;
    colProgress: string;
    colStatus: string;
    colProfile: string;
    profileLink: string;
    statusLikelyRise: string;
    statusWatchRise: string;
    statusLikelyFall: string;
    statusWatchFall: string;
    statusStable: string;
    alreadyUp: string;
    alreadyDown: string;
    empty: string;
  };
}) {
  const [tab, setTab] = useState<Tab>(
    likelyRiseCount + likelyFallCount > 0 ? "likely" : "all",
  );
  const [position, setPosition] = useState("all");
  const { sortKey, sortDir, toggle, setSort } = useInsightsTableSort<SortKey>(
    "progress",
    "desc",
  );

  const statusLabel = (status: PriceForecastStatus): string => {
    switch (status) {
      case "likely_rise":
        return labels.statusLikelyRise;
      case "watch_rise":
        return labels.statusWatchRise;
      case "likely_fall":
        return labels.statusLikelyFall;
      case "watch_fall":
        return labels.statusWatchFall;
      default:
        return labels.statusStable;
    }
  };

  const sorted = useMemo(() => {
    let list = [...rows];
    if (position !== "all") {
      list = list.filter((r) => r.position === position);
    }
    switch (tab) {
      case "likely":
        list = list.filter(
          (r) => r.status === "likely_rise" || r.status === "likely_fall",
        );
        break;
      case "rise":
        list = list.filter((r) => r.progress > 0);
        break;
      case "fall":
        list = list.filter((r) => r.progress < 0);
        break;
      default:
        break;
    }
    return sortInsightRows(
      list,
      (row) => forecastSortValue(row, sortKey),
      sortDir,
    );
  }, [rows, tab, position, sortKey, sortDir]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "likely", label: labels.tabLikely },
    { id: "rise", label: labels.tabRise },
    { id: "fall", label: labels.tabFall },
    { id: "all", label: labels.tabAll },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {labels.intro.replace("{gw}", String(gw))}{" "}
        {source === "live" ? labels.sourceLive : labels.sourceDb}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-emerald-400/80">
            {labels.summaryRise}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400">
            {likelyRiseCount}
          </p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-red-400/80">
            {labels.summaryFall}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-red-400">
            {likelyFallCount}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              const preset = TAB_SORT[t.id];
              setSort(preset.key, preset.dir);
            }}
            className={
              tab === t.id
                ? "rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-brand-accent-foreground"
                : "rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {labels.filterPos}
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
          >
            <option value="all">{labels.posAll}</option>
            <option value="GKP">{labels.posGkp}</option>
            <option value="DEF">{labels.posDef}</option>
            <option value="MID">{labels.posMid}</option>
            <option value="FWD">{labels.posFwd}</option>
          </select>
        </label>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="scroll-table scroll-table--bordered scroll-table--muted">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <InsightsSortableTh
                  label={labels.colPlayer}
                  active={sortKey === "player"}
                  dir={sortDir}
                  onSort={() => toggle("player", "asc")}
                />
                <InsightsSortableTh
                  label={labels.colTeam}
                  active={sortKey === "team"}
                  dir={sortDir}
                  onSort={() => toggle("team", "asc")}
                />
                <InsightsSortableTh
                  label={labels.colPos}
                  active={sortKey === "pos"}
                  dir={sortDir}
                  onSort={() => toggle("pos", "asc")}
                />
                <InsightsSortableTh
                  label={labels.colPrice}
                  active={sortKey === "price"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("price")}
                />
                <InsightsSortableTh
                  label={labels.colOwn}
                  active={sortKey === "own"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("own")}
                />
                <InsightsSortableTh
                  label={labels.colNet}
                  active={sortKey === "net"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("net")}
                />
                <InsightsSortableTh
                  label={labels.colProgress}
                  active={sortKey === "progress"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("progress")}
                />
                <th className="px-3 py-2">{labels.colStatus}</th>
                <th className="px-3 py-2">{labels.colProfile}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.fpl_id}
                  className="border-b border-border/60 hover:bg-card/50"
                >
                  <td className="px-3 py-2 font-medium text-foreground">
                    {row.web_name}
                    {row.cost_change_event > 0 ? (
                      <span className="ml-1 text-[10px] text-emerald-400">
                        {labels.alreadyUp}
                      </span>
                    ) : null}
                    {row.cost_change_event < 0 ? (
                      <span className="ml-1 text-[10px] text-red-400">
                        {labels.alreadyDown}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.team}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.position ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtPrice(row.current_price)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {row.selected_by_percent.toFixed(1)}%
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-medium ${deltaClass(row.net_transfers)}`}
                  >
                    {fmtInt(row.net_transfers)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className={
                            row.progress >= 0 ? "h-full bg-emerald-400" : "h-full bg-red-400"
                          }
                          style={{
                            width: `${Math.min(100, Math.abs(row.progress) * 100)}%`,
                          }}
                        />
                      </div>
                      <span
                        className={`w-10 text-right tabular-nums text-xs font-medium ${deltaClass(row.progress)}`}
                      >
                        {fmtPct(row.progress)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(row.status)}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/player/${row.fpl_id}`}
                      className="text-brand-accent no-underline hover:underline"
                    >
                      {labels.profileLink}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
