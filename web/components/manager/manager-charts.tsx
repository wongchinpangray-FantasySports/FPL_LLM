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

function buildPolyline(
  xs: number[],
  ys: number[],
  w: number,
  h: number,
  pad: { l: number; r: number; t: number; b: number },
): string {
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padY = Math.max((maxY - minY) * 0.08, 1);
  const lo = minY - padY;
  const hi = maxY + padY;
  const pts: string[] = [];
  for (let i = 0; i < xs.length; i++) {
    const x = pad.l + (xs.length <= 1 ? innerW / 2 : (i / (xs.length - 1)) * innerW);
    const y = scaleY(ys[i]!, lo, hi, pad.t, pad.t + innerH);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

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
    const padRect = { l: 44, r: 16, t: 16, b: 36 };
    const innerW = 640 - padRect.l - padRect.r;
    const innerH = 220 - padRect.t - padRect.b;
    const pts: string[] = [];
    const dots: { cx: number; cy: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const x =
        padRect.l +
        (rows.length <= 1
          ? innerW / 2
          : (i / (rows.length - 1)) * innerW);
      const y = scaleY(ys[i]!, lo, hi, padRect.t, padRect.t + innerH);
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      dots.push({ cx: x, cy: y });
    }
    return {
      poly: pts.join(" "),
      dots,
      lo,
      hi,
    };
  }, [rows]);

  if (!rows.length || !layout) {
    return (
      <p className="text-xs text-slate-500">{t("chartOrEmpty")}</p>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox="0 0 640 220"
        className="h-auto w-full max-h-[280px]"
        role="img"
        aria-label={t("chartOrAria")}
      >
        <rect width="640" height="220" fill="transparent" />
        <text x={44} y={14} fontSize={10} fill="rgb(148 163 184)">
          {t("chartOrHint")}
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
      </svg>
      <div className="mt-1 flex flex-wrap justify-between gap-1 px-1 text-[10px] tabular-nums text-slate-500">
        <span>{t("chartScaleMin", { r: Math.round(layout.lo) })}</span>
        <span>{t("chartScaleMax", { r: Math.round(layout.hi) })}</span>
      </div>
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

  const points = useMemo(() => {
    const ys = rows.map((r) => r.percentile_rank);
    return buildPolyline(
      rows.map((_, i) => i),
      ys,
      640,
      160,
      { l: 36, r: 12, t: 14, b: 28 },
    );
  }, [rows]);

  if (!rows.length) return null;

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox="0 0 640 160" className="h-auto w-full max-h-[200px]" role="img">
        <text x={36} y={12} fontSize={10} fill="rgb(148 163 184)">
          {t("chartPctHint")}
        </text>
        <polyline
          fill="none"
          stroke="rgb(56 189 248)"
          strokeWidth={2}
          strokeLinejoin="round"
          points={points}
        />
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

  const polylines = useMemo(() => {
    const n = rows.length;
    if (!n) return [];
    const innerW = 640 - 48 - 12;
    const innerH = 200 - 20 - 32;
    const pad = { l: 48, r: 12, t: 20, b: 32 };

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
    if (!allVals.length) return [];
    let minY = Math.min(...allVals);
    let maxY = Math.max(...allVals);
    minY = Math.min(minY, 0);
    maxY = Math.max(maxY, 1);
    const padY = Math.max((maxY - minY) * 0.08, 2);
    const lo = minY - padY;
    const hi = maxY + padY;

    return defs.map((s) => {
      const pts: string[] = [];
      for (let i = 0; i < n; i++) {
        const v = s.vals[i];
        if (v == null || !Number.isFinite(v)) continue;
        const x =
          pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
        const y = scaleY(v, lo, hi, pad.t, pad.t + innerH);
        pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      }
      return { ...s, d: pts.join(" ") };
    });
  }, [rows]);

  const legend = [
    { key: "you", label: t("legendYou"), color: "rgb(34 197 94)" },
    { key: "global", label: t("legendGlobal"), color: "rgb(148 163 184)" },
    { key: "t10", label: t("legend10k"), color: "rgb(251 191 36)" },
    { key: "t100", label: t("legend100k"), color: "rgb(167 139 250)" },
  ];

  if (!rows.length) {
    return (
      <p className="text-xs text-slate-500">{t("chartPtsEmpty")}</p>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox="0 0 640 200"
        className="h-auto w-full max-h-[260px]"
        role="img"
        aria-label={t("chartPtsAria")}
      >
        <text x={48} y={14} fontSize={10} fill="rgb(148 163 184)">
          {t("chartPtsHint")}
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
