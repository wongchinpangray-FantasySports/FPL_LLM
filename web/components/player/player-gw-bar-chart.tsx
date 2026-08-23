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

function rollingAvgPts(
  rows: PlayerGwHistoryRow[],
  idx: number,
  window: number,
): number {
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

function formatPointLabel(metric: GwChartMetric, v: number): string {
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

type ChartSlot = {
  gw: number;
  value: number | null;
  label: string | null;
};

type Props = {
  rows: PlayerGwHistoryRow[];
  className?: string;
};

/** Always reserve `span` GW columns so early-season charts don't stretch one bar. */
function buildSlots(
  rows: PlayerGwHistoryRow[],
  span: 5 | 10,
  metric: GwChartMetric,
): ChartSlot[] {
  const byGw = new Map<number, number>();
  for (let i = 0; i < rows.length; i++) {
    byGw.set(rows[i]!.gw, metricValue(rows, i, metric));
  }

  const lastPlayed = rows[rows.length - 1]!.gw;
  const startGw = Math.max(1, lastPlayed - span + 1);
  const slots: ChartSlot[] = [];
  for (let gw = startGw; gw < startGw + span; gw++) {
    const value = byGw.has(gw) ? byGw.get(gw)! : null;
    slots.push({
      gw,
      value,
      label: value != null ? formatPointLabel(metric, value) : null,
    });
  }
  return slots;
}

export function PlayerGwBarChart({ rows, className }: Props) {
  const t = useTranslations("playerGwChart");
  const [metric, setMetric] = useState<GwChartMetric>("total_points");
  const [gwSpan, setGwSpan] = useState<5 | 10>(5);

  const slots = useMemo(
    () => (rows.length ? buildSlots(rows, gwSpan, metric) : []),
    [rows, gwSpan, metric],
  );

  const { maxVal, points } = useMemo(() => {
    const defined = slots
      .map((s) => s.value)
      .filter((v): v is number => v != null);
    const max = Math.max(...defined, 1);
    const padTop = 18;
    const padBottom = 10;
    const plotH = 100 - padTop - padBottom;

    const pts = slots.map((s) => {
      if (s.value == null) {
        return { ...s, yPct: null as number | null };
      }
      const yPct = padTop + plotH * (1 - s.value / max);
      return { ...s, yPct };
    });

    return { maxVal: max, points: pts };
  }, [slots]);

  const linePath = useMemo(() => {
    const n = Math.max(points.length, 1);
    const parts: string[] = [];
    let started = false;
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      if (p.yPct == null) {
        started = false;
        continue;
      }
      // Column centers: (i + 0.5) / n — same as label column centers
      const x = ((i + 0.5) / n) * 100;
      parts.push(
        `${started ? "L" : "M"}${x.toFixed(2)} ${p.yPct.toFixed(2)}`,
      );
      started = true;
    }
    return parts.join(" ");
  }, [points]);

  if (!rows.length) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 sm:rounded-xl",
        className,
      )}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {t("sectionTitle")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="hidden sm:inline">{t("metricLabel")}</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as GwChartMetric)}
              className="rounded-md border border-border bg-input px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
              aria-label={t("metricLabel")}
            >
              {METRIC_ORDER.map((m) => (
                <option key={m} value={m}>
                  {t(`metrics.${m}`)}
                </option>
              ))}
            </select>
          </label>
          <div
            className="flex rounded-md border border-border p-0.5"
            role="group"
            aria-label={t("windowLabel")}
          >
            <button
              type="button"
              onClick={() => setGwSpan(5)}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                gwSpan === 5
                  ? "bg-brand-accent/25 text-brand-accent"
                  : "text-muted-foreground hover:text-foreground/90",
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
                  : "text-muted-foreground hover:text-foreground/90",
              )}
            >
              {t("range10")}
            </button>
          </div>
        </div>
      </div>

      <p className="mb-2 text-[10px] text-muted-foreground">
        {t("yMax", { v: formatPointLabel(metric, maxVal) })}
      </p>

      <div className="relative h-40 w-full sm:h-44">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={t("sectionTitle")}
        >
          {[0.25, 0.5, 0.75].map((f) => {
            const y = 18 + (100 - 18 - 10) * (1 - f);
            return (
              <line
                key={f}
                x1="0"
                x2="100"
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              className="stroke-brand-accent"
              strokeWidth={2.2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        <div
          className="pointer-events-none absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
        >
          {points.map((p) => (
            <div key={p.gw} className="relative">
              {p.yPct != null && p.value != null ? (
                <div
                  className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ top: `${p.yPct}%` }}
                >
                  <span className="mb-1 text-[10px] font-semibold tabular-nums text-foreground/90">
                    {p.label}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-brand-accent bg-background shadow-sm" />
                </div>
              ) : (
                <div className="absolute bottom-[10%] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-muted-foreground/35" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        className="mt-1 grid"
        style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
      >
        {slots.map((s) => (
          <span
            key={s.gw}
            className={cn(
              "text-center text-[10px] tabular-nums",
              s.value != null
                ? "text-muted-foreground"
                : "text-muted-foreground/45",
            )}
          >
            GW{s.gw}
          </span>
        ))}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        {t("footnote")}
      </p>
    </div>
  );
}
