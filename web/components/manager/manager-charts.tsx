"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { FplHistoryCurrentRow } from "@/lib/fpl";
import type { ManagerGwCompareRow } from "@/lib/manager-performance";

function scaleY(
  v: number,
  min: number,
  max: number,
  y0: number,
  y1: number,
): number {
  if (max === min) return (y0 + y1) / 2;
  return y0 + ((max - v) / (max - min)) * (y1 - y0);
}

/** Linear tick positions between lo and hi (inclusive). */
function linearYTicks(lo: number, hi: number, count: number): number[] {
  if (count < 2) return [lo];
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    ticks.push(lo + ((hi - lo) * i) / (count - 1));
  }
  return ticks;
}

function formatRankAxis(v: number): string {
  const r = Math.round(v);
  if (r >= 1_000_000) return `${(r / 1_000_000).toFixed(1)}M`;
  if (r >= 10_000) return `${Math.round(r / 1000)}k`;
  if (r >= 1000) return `${(r / 1000).toFixed(1)}k`;
  return String(r);
}

function formatPointsAxis(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

const AXIS = {
  stroke: "rgb(71 85 105)",
  grid: "rgba(148, 163, 184, 0.12)",
  tick: "rgb(100 116 139)",
  label: "rgb(148 163 184)",
};

export function ManagerOrTrendChart({
  rows,
  className,
}: {
  rows: Pick<FplHistoryCurrentRow, "event" | "overall_rank">[];
  className?: string;
}) {
  const t = useTranslations("managerPage");

  const layout = useMemo(() => {
    if (!rows.length) return null;
    const ys = rows.map((r) => r.overall_rank);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const pad = Math.max((max - min) * 0.05, 50);
    const lo = Math.max(1, min - pad);
    const hi = max + pad;

    const padRect = { l: 58, r: 18, t: 26, b: 52 };
    const W = 640;
    const H = 260;
    const innerW = W - padRect.l - padRect.r;
    const innerH = H - padRect.t - padRect.b;

    const pts: string[] = [];
    const dots: { cx: number; cy: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const x =
        padRect.l +
        (rows.length <= 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
      const y = scaleY(ys[i]!, lo, hi, padRect.t, padRect.t + innerH);
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      dots.push({ cx: x, cy: y });
    }

    const yTicks = linearYTicks(lo, hi, 5);

    const n = rows.length;
    const xIndices: number[] = [];
    if (n <= 12) {
      for (let i = 0; i < n; i++) xIndices.push(i);
    } else {
      const step = Math.ceil(n / 10);
      for (let i = 0; i < n; i += step) xIndices.push(i);
      if (xIndices[xIndices.length - 1] !== n - 1) xIndices.push(n - 1);
    }

    return {
      poly: pts.join(" "),
      dots,
      lo,
      hi,
      padRect,
      W,
      H,
      innerW,
      innerH,
      yTicks,
      xIndices,
      events: rows.map((r) => r.event),
    };
  }, [rows]);

  if (!rows.length || !layout) {
    return (
      <p className="text-xs text-slate-500">{t("chartOrEmpty")}</p>
    );
  }

  const {
    padRect,
    W,
    H,
    innerW,
    innerH,
    yTicks,
    xIndices,
    events,
  } = layout;
  const x0 = padRect.l;
  const yBottom = padRect.t + innerH;

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full max-h-[320px]"
        role="img"
        aria-label={t("chartOrAria")}
      >
        <rect width={W} height={H} fill="transparent" />
        <text x={padRect.l} y={16} fontSize={10} fill={AXIS.label}>
          {t("chartOrHint")}
        </text>

        {/* Horizontal grid + Y ticks */}
        {yTicks.map((tick) => {
          const y = scaleY(tick, layout.lo, layout.hi, padRect.t, yBottom);
          return (
            <g key={`gy-${tick}`}>
              <line
                x1={x0}
                x2={x0 + innerW}
                y1={y}
                y2={y}
                stroke={AXIS.grid}
                strokeWidth={1}
              />
              <line
                x1={x0 - 5}
                x2={x0}
                y1={y}
                y2={y}
                stroke={AXIS.tick}
                strokeWidth={1}
              />
              <text
                x={x0 - 8}
                y={y}
                fontSize={9}
                fill={AXIS.label}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatRankAxis(tick)}
              </text>
            </g>
          );
        })}

        {/* Y axis */}
        <line
          x1={x0}
          y1={padRect.t}
          x2={x0}
          y2={yBottom}
          stroke={AXIS.stroke}
          strokeWidth={1}
        />

        {/* X axis */}
        <line
          x1={x0}
          y1={yBottom}
          x2={x0 + innerW}
          y2={yBottom}
          stroke={AXIS.stroke}
          strokeWidth={1}
        />

        {/* X ticks + GW labels */}
        {xIndices.map((i) => {
          const x =
            x0 +
            (events.length <= 1
              ? innerW / 2
              : (i / (events.length - 1)) * innerW);
          return (
            <g key={`gx-${events[i]}-${i}`}>
              <line
                x1={x}
                x2={x}
                y1={yBottom}
                y2={yBottom + 5}
                stroke={AXIS.tick}
                strokeWidth={1}
              />
              <text
                x={x}
                y={yBottom + 18}
                fontSize={9}
                fill={AXIS.label}
                textAnchor="middle"
              >
                {t("chartAxisGwTick", { gw: events[i] })}
              </text>
            </g>
          );
        })}

        <text
          x={x0 + innerW / 2}
          y={H - 4}
          fontSize={10}
          fill={AXIS.label}
          textAnchor="middle"
        >
          {t("chartAxisGw")}
        </text>

        <polyline
          fill="none"
          stroke="rgb(34 197 94)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={layout.poly}
        />
        {layout.dots.map((d, i) => (
          <circle key={rows[i]!.event} cx={d.cx} cy={d.cy} r={3} fill="rgb(34 197 94)" />
        ))}

        <text
          x={12}
          y={padRect.t + innerH / 2}
          fontSize={10}
          fill={AXIS.label}
          transform={`rotate(-90 12 ${padRect.t + innerH / 2})`}
          textAnchor="middle"
        >
          {t("chartAxisOr")}
        </text>
      </svg>
    </div>
  );
}

export function ManagerPercentileChart({
  rows,
  className,
}: {
  rows: Pick<FplHistoryCurrentRow, "event" | "percentile_rank">[];
  className?: string;
}) {
  const t = useTranslations("managerPage");

  const layout = useMemo(() => {
    if (!rows.length) return null;
    const ys = rows.map((r) => r.percentile_rank);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const padY = Math.max((max - min) * 0.1, 3);
    const lo = Math.max(0, min - padY);
    const hi = Math.min(100, max + padY);

    const padRect = { l: 44, r: 14, t: 24, b: 46 };
    const W = 640;
    const H = 210;
    const innerW = W - padRect.l - padRect.r;
    const innerH = H - padRect.t - padRect.b;

    const pts: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const x =
        padRect.l +
        (rows.length <= 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
      const y = scaleY(ys[i]!, lo, hi, padRect.t, padRect.t + innerH);
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }

    const yTicks = linearYTicks(lo, hi, 5);

    const n = rows.length;
    const xIndices: number[] = [];
    if (n <= 12) {
      for (let i = 0; i < n; i++) xIndices.push(i);
    } else {
      const step = Math.ceil(n / 10);
      for (let i = 0; i < n; i += step) xIndices.push(i);
      if (xIndices[xIndices.length - 1] !== n - 1) xIndices.push(n - 1);
    }

    return {
      poly: pts.join(" "),
      lo,
      hi,
      padRect,
      W,
      H,
      innerW,
      innerH,
      yTicks,
      xIndices,
      events: rows.map((r) => r.event),
    };
  }, [rows]);

  if (!rows.length || !layout) return null;

  const { padRect, W, H, innerW, innerH, yTicks, xIndices, events } = layout;
  const x0 = padRect.l;
  const yBottom = padRect.t + innerH;

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full max-h-[240px]"
        role="img"
      >
        <rect width={W} height={H} fill="transparent" />
        <text x={padRect.l} y={14} fontSize={10} fill={AXIS.label}>
          {t("chartPctHint")}
        </text>

        {yTicks.map((tick) => {
          const y = scaleY(tick, layout.lo, layout.hi, padRect.t, yBottom);
          return (
            <g key={`py-${tick}`}>
              <line
                x1={x0}
                x2={x0 + innerW}
                y1={y}
                y2={y}
                stroke={AXIS.grid}
                strokeWidth={1}
              />
              <line
                x1={x0 - 5}
                x2={x0}
                y1={y}
                y2={y}
                stroke={AXIS.tick}
                strokeWidth={1}
              />
              <text
                x={x0 - 8}
                y={y}
                fontSize={9}
                fill={AXIS.label}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {Math.round(tick)}
              </text>
            </g>
          );
        })}

        <line
          x1={x0}
          y1={padRect.t}
          x2={x0}
          y2={yBottom}
          stroke={AXIS.stroke}
          strokeWidth={1}
        />
        <line
          x1={x0}
          y1={yBottom}
          x2={x0 + innerW}
          y2={yBottom}
          stroke={AXIS.stroke}
          strokeWidth={1}
        />

        {xIndices.map((i) => {
          const x =
            x0 +
            (events.length <= 1
              ? innerW / 2
              : (i / (events.length - 1)) * innerW);
          return (
            <g key={`px-${events[i]}-${i}`}>
              <line
                x1={x}
                x2={x}
                y1={yBottom}
                y2={yBottom + 5}
                stroke={AXIS.tick}
                strokeWidth={1}
              />
              <text
                x={x}
                y={yBottom + 18}
                fontSize={9}
                fill={AXIS.label}
                textAnchor="middle"
              >
                {t("chartAxisGwTick", { gw: events[i] })}
              </text>
            </g>
          );
        })}

        <text
          x={x0 + innerW / 2}
          y={H - 4}
          fontSize={10}
          fill={AXIS.label}
          textAnchor="middle"
        >
          {t("chartAxisGw")}
        </text>

        <polyline
          fill="none"
          stroke="rgb(56 189 248)"
          strokeWidth={2}
          strokeLinejoin="round"
          points={layout.poly}
        />

        <text
          x={10}
          y={padRect.t + innerH / 2}
          fontSize={10}
          fill={AXIS.label}
          transform={`rotate(-90 10 ${padRect.t + innerH / 2})`}
          textAnchor="middle"
        >
          {t("chartAxisPct")}
        </text>
      </svg>
    </div>
  );
}

export function ManagerPointsCompareChart({
  rows,
  className,
}: {
  rows: ManagerGwCompareRow[];
  className?: string;
}) {
  const t = useTranslations("managerPage");

  const layout = useMemo(() => {
    const n = rows.length;
    if (!n) return null;

    const padRect = { l: 52, r: 16, t: 30, b: 50 };
    const W = 640;
    const H = 240;
    const innerW = W - padRect.l - padRect.r;
    const innerH = H - padRect.t - padRect.b;

    const defs = [
      { key: "you" as const, color: "rgb(34 197 94)", vals: rows.map((r) => r.pointsYou) },
      {
        key: "global" as const,
        color: "rgb(148 163 184)",
        vals: rows.map((r) => r.pointsGlobalAvg),
      },
      {
        key: "t10" as const,
        color: "rgb(251 191 36)",
        vals: rows.map((r) => r.pointsTop10kSample),
      },
      {
        key: "t100" as const,
        color: "rgb(167 139 250)",
        vals: rows.map((r) => r.pointsTop100kSample),
      },
    ];

    const allVals: number[] = [];
    for (const s of defs) {
      for (const v of s.vals) {
        if (typeof v === "number" && Number.isFinite(v)) allVals.push(v);
      }
    }
    if (!allVals.length) return null;

    let minY = Math.min(...allVals);
    let maxY = Math.max(...allVals);
    minY = Math.min(minY, 0);
    maxY = Math.max(maxY, 1);
    const padY = Math.max((maxY - minY) * 0.08, 2);
    const lo = minY - padY;
    const hi = maxY + padY;

    const polylines = defs.map((s) => {
      const pts: string[] = [];
      for (let i = 0; i < n; i++) {
        const v = s.vals[i];
        if (v == null || !Number.isFinite(v)) continue;
        const x =
          padRect.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
        const y = scaleY(v, lo, hi, padRect.t, padRect.t + innerH);
        pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      }
      return { ...s, d: pts.join(" ") };
    });

    const yTicks = linearYTicks(lo, hi, 5);

    const xIndices: number[] = [];
    if (n <= 12) {
      for (let i = 0; i < n; i++) xIndices.push(i);
    } else {
      const step = Math.ceil(n / 10);
      for (let i = 0; i < n; i += step) xIndices.push(i);
      if (xIndices[xIndices.length - 1] !== n - 1) xIndices.push(n - 1);
    }

    return {
      polylines,
      lo,
      hi,
      padRect,
      W,
      H,
      innerW,
      innerH,
      yTicks,
      xIndices,
      events: rows.map((r) => r.event),
    };
  }, [rows]);

  const legend = [
    { key: "you", label: t("legendYou"), color: "rgb(34 197 94)" },
    { key: "global", label: t("legendGlobal"), color: "rgb(148 163 184)" },
    { key: "t10", label: t("legend10k"), color: "rgb(251 191 36)" },
    { key: "t100", label: t("legend100k"), color: "rgb(167 139 250)" },
  ];

  if (!rows.length || !layout) {
    return (
      <p className="text-xs text-slate-500">{t("chartPtsEmpty")}</p>
    );
  }

  const {
    padRect,
    W,
    H,
    innerW,
    innerH,
    yTicks,
    xIndices,
    events,
    polylines,
    lo,
    hi,
  } = layout;
  const x0 = padRect.l;
  const yBottom = padRect.t + innerH;

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full max-h-[300px]"
        role="img"
        aria-label={t("chartPtsAria")}
      >
        <text x={padRect.l} y={18} fontSize={10} fill={AXIS.label}>
          {t("chartPtsHint")}
        </text>

        {yTicks.map((tick) => {
          const y = scaleY(tick, lo, hi, padRect.t, yBottom);
          return (
            <g key={`qy-${tick}`}>
              <line
                x1={x0}
                x2={x0 + innerW}
                y1={y}
                y2={y}
                stroke={AXIS.grid}
                strokeWidth={1}
              />
              <line
                x1={x0 - 5}
                x2={x0}
                y1={y}
                y2={y}
                stroke={AXIS.tick}
                strokeWidth={1}
              />
              <text
                x={x0 - 8}
                y={y}
                fontSize={9}
                fill={AXIS.label}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatPointsAxis(tick)}
              </text>
            </g>
          );
        })}

        <line
          x1={x0}
          y1={padRect.t}
          x2={x0}
          y2={yBottom}
          stroke={AXIS.stroke}
          strokeWidth={1}
        />
        <line
          x1={x0}
          y1={yBottom}
          x2={x0 + innerW}
          y2={yBottom}
          stroke={AXIS.stroke}
          strokeWidth={1}
        />

        {xIndices.map((i) => {
          const x =
            x0 +
            (events.length <= 1
              ? innerW / 2
              : (i / (events.length - 1)) * innerW);
          return (
            <g key={`qx-${events[i]}-${i}`}>
              <line
                x1={x}
                x2={x}
                y1={yBottom}
                y2={yBottom + 5}
                stroke={AXIS.tick}
                strokeWidth={1}
              />
              <text
                x={x}
                y={yBottom + 18}
                fontSize={9}
                fill={AXIS.label}
                textAnchor="middle"
              >
                {t("chartAxisGwTick", { gw: events[i] })}
              </text>
            </g>
          );
        })}

        <text
          x={x0 + innerW / 2}
          y={H - 4}
          fontSize={10}
          fill={AXIS.label}
          textAnchor="middle"
        >
          {t("chartAxisGw")}
        </text>

        {polylines.map((pl) =>
          pl.d ? (
            <polyline
              key={pl.key}
              fill="none"
              stroke={pl.color}
              strokeWidth={pl.key === "you" ? 2.5 : 1.75}
              strokeOpacity={pl.key === "you" ? 1 : 0.9}
              strokeLinejoin="round"
              points={pl.d}
            />
          ) : null,
        )}

        <text
          x={11}
          y={padRect.t + innerH / 2}
          fontSize={10}
          fill={AXIS.label}
          transform={`rotate(-90 11 ${padRect.t + innerH / 2})`}
          textAnchor="middle"
        >
          {t("chartAxisPts")}
        </text>
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
        {legend.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span
              className="h-2 w-4 rounded-sm"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="text-slate-400">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
