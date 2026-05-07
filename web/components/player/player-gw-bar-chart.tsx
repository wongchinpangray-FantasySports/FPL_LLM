"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { PlayerGwHistoryRow } from "@/lib/player-gw-history";

export type GwChartMetric =
  | "total_points"
  | "minutes"
  | "expected_goals"
  | "expected_assists"
  | "goals_scored"
  | "assists"
  | "bonus"
  | "bps"
  | "ict_index"
  | "clean_sheets"
  | "saves"
  | "defensive_contribution"
  | "formRolling";

const METRIC_ORDER: GwChartMetric[] = [
  "total_points",
  "formRolling",
  "expected_goals",
  "expected_assists",
  "goals_scored",
  "assists",
  "minutes",
  "bonus",
  "bps",
  "ict_index",
  "clean_sheets",
  "saves",
  "defensive_contribution",
];

function rollingAvgPts(rows: PlayerGwHistoryRow[], idx: number, window: number): number {
  const start = Math.max(0, idx - (window - 1));
  let sum = 0;
  let n = 0;
  for (let i = start; i <= idx; i++) {
    sum += rows[i]!.total_points;
    n++;
  }
  return n ? sum / n : 0;
}

function metricValue(
  rows: PlayerGwHistoryRow[],
  idx: number,
  metric: GwChartMetric,
): number {
  const row = rows[idx]!;
  switch (metric) {
    case "total_points":
      return row.total_points;
    case "minutes":
      return row.minutes;
    case "expected_goals":
      return row.expected_goals;
    case "expected_assists":
      return row.expected_assists;
    case "goals_scored":
      return row.goals_scored;
    case "assists":
      return row.assists;
    case "bonus":
      return row.bonus;
    case "bps":
      return row.bps;
    case "ict_index":
      return row.ict_index;
    case "clean_sheets":
      return row.clean_sheets;
    case "saves":
      return row.saves;
    case "defensive_contribution":
      return row.defensive_contribution;
    case "formRolling":
      return rollingAvgPts(rows, idx, 3);
    default:
      return 0;
  }
}

function formatBarLabel(metric: GwChartMetric, v: number): string {
  if (metric === "expected_goals" || metric === "expected_assists") {
    return v.toFixed(2);
  }
  if (metric === "formRolling" || metric === "ict_index") {
    return v.toFixed(1);
  }
  if (
    metric === "minutes" ||
    metric === "bps" ||
    metric === "total_points" ||
    metric === "bonus" ||
    metric === "defensive_contribution"
  ) {
    return Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1);
  }
  return String(Math.round(v));
}

type Props = {
  rows: PlayerGwHistoryRow[];
  className?: string;
};

export function PlayerGwBarChart({ rows, className }: Props) {
  const t = useTranslations("playerGwChart");
  const [metric, setMetric] = useState<GwChartMetric>("total_points");
  const [gwSpan, setGwSpan] = useState<5 | 10>(5);

  const slice = useMemo(() => {
    if (!rows.length) return [];
    const n = Math.min(gwSpan, rows.length);
    return rows.slice(-n);
  }, [rows, gwSpan]);

  const { values, maxVal } = useMemo(() => {
    const vals = slice.map((_, i) => {
      const idxInFull = rows.length - slice.length + i;
      return metricValue(rows, idxInFull, metric);
    });
    const max = Math.max(...vals, 1e-6);
    return { values: vals, maxVal: max };
  }, [rows, slice, metric]);

  if (!rows.length) {
    return (
      <p className="text-xs leading-relaxed text-slate-500">{t("empty")}</p>
    );
  }

  return (
    <div className={cn("rounded-lg border border-white/10 bg-white/[0.03] p-3 sm:rounded-xl", className)}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {t("sectionTitle")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="hidden sm:inline">{t("metricLabel")}</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as GwChartMetric)}
              className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
              aria-label={t("metricLabel")}
            >
              {METRIC_ORDER.map((m) => (
                <option key={m} value={m}>
                  {t(`metrics.${m}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex rounded-md border border-white/10 p-0.5" role="group" aria-label={t("windowLabel")}>
            <button
              type="button"
              onClick={() => setGwSpan(5)}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                gwSpan === 5
                  ? "bg-brand-accent/25 text-brand-accent"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {t("range5")}
            </button>
            <button
              type="button"
              onClick={() => setGwSpan(10)}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                gwSpan === 10
                  ? "bg-brand-accent/25 text-brand-accent"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {t("range10")}
            </button>
          </div>
        </div>
      </div>

      <p className="mb-2 text-[10px] text-slate-500">{t("yMax", { v: formatBarLabel(metric, maxVal) })}</p>

      <div className="flex h-36 items-end gap-1 sm:gap-1.5">
        {slice.map((row, i) => {
          const v = values[i] ?? 0;
          const pct = maxVal > 0 ? (v / maxVal) * 100 : 0;
          const label = formatBarLabel(metric, v);
          return (
            <div
              key={row.gw}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-[10px] font-semibold tabular-nums text-slate-200">
                {label}
              </span>
              <div className="flex h-28 w-full flex-col justify-end rounded-t bg-black/20">
                <div
                  className="w-full rounded-t bg-brand-accent/85 transition-all hover:bg-brand-accent"
                  style={{
                    height: `${pct}%`,
                    minHeight: v !== 0 ? 3 : 0,
                  }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-slate-500">
                GW{row.gw}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{t("footnote")}</p>
    </div>
  );
}
