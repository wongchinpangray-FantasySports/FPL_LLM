"use client";

import { useMemo } from "react";
import type { RankHistoryPoint } from "@/lib/fpl-rank-series";

function formatRank(n: number): string {
  const r = Math.round(n);
  if (r >= 1_000_000) return `${(r / 1_000_000).toFixed(1)}M`;
  if (r >= 10_000) return `${Math.round(r / 1000)}k`;
  if (r >= 1000) return `${(r / 1000).toFixed(1)}k`;
  return r.toLocaleString();
}

function scaleYLog(
  rank: number,
  lo: number,
  hi: number,
  yTop: number,
  yBottom: number,
): number {
  const v = Math.log10(Math.max(1, rank));
  if (hi === lo) return (yTop + yBottom) / 2;
  return yTop + ((v - lo) / (hi - lo)) * (yBottom - yTop);
}

function toPoints(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${x},${ys[i]}`).join(" ");
}

const AXIS_GWS = 5;

function axisWindow(events: number[]): number[] {
  const last = Math.max(...events);
  const end = Math.max(last, AXIS_GWS);
  const start = Math.max(1, end - AXIS_GWS + 1);
  return Array.from({ length: AXIS_GWS }, (_, i) => start + i);
}

function xAt(
  event: number,
  start: number,
  count: number,
  x0: number,
  innerW: number,
): number {
  if (count <= 1) return x0 + innerW / 2;
  return x0 + ((event - start) / (count - 1)) * innerW;
}

export function HomeRankSparkline({
  points,
  labels,
}: {
  points: RankHistoryPoint[];
  labels: {
    you: string;
    avg: string;
    aria: string;
    hint: string;
  };
}) {
  const layout = useMemo(() => {
    if (!points.length) return null;
    const you = points.map((p) => p.overall_rank);
    const avg = points
      .map((p) => p.average_rank)
      .filter((n): n is number => n != null && n > 0);
    const all = [...you, ...avg];
    const minR = Math.min(...all);
    const maxR = Math.max(...all);
    const lo = Math.log10(Math.max(1, minR / 1.35));
    const hi = Math.log10(Math.max(minR + 1, maxR * 1.55));

    const w = 320;
    const h = 108;
    const pad = { l: 38, r: 18, t: 8, b: 22 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const axis = axisWindow(points.map((p) => p.event));
    const start = axis[0]!;
    const xs = points.map((p) => xAt(p.event, start, axis.length, pad.l, innerW));
    const youY = you.map((r) => scaleYLog(r, lo, hi, pad.t, pad.t + innerH));
    const avgY = points.map((p) =>
      p.average_rank != null
        ? scaleYLog(p.average_rank, lo, hi, pad.t, pad.t + innerH)
        : null,
    );
    const avgXs = xs.filter((_, i) => avgY[i] != null);
    const avgYs = avgY.filter((y): y is number => y != null);
    const axisXs = axis.map((gw) => xAt(gw, start, axis.length, pad.l, innerW));

    return {
      w,
      h,
      pad,
      axis,
      axisXs,
      xs,
      youY,
      avgXs,
      avgYs,
      lo,
      hi,
      lastYou: you[you.length - 1]!,
      lastAvg: avg.at(-1) ?? null,
    };
  }, [points]);

  if (!layout) return null;

  const { w, h, pad, axis, axisXs, xs, youY, avgXs, avgYs, lastYou, lastAvg } =
    layout;
  const ticks = [layout.lo, layout.hi].map((logV) => 10 ** logV);

  return (
    <div className="rounded-lg border border-border/70 bg-card/40 px-2.5 py-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-1.5 w-3 rounded-full bg-brand-accent" />
            {labels.you}
            <span className="tabular-nums font-medium text-brand-accent">
              {formatRank(lastYou)}
            </span>
          </span>
          {lastAvg != null ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-px w-3 border-t border-dashed border-slate-400"
                aria-hidden
              />
              {labels.avg}
              <span className="tabular-nums font-medium text-foreground/80">
                {formatRank(lastAvg)}
              </span>
            </span>
          ) : null}
        </div>
        <span className="text-[10px] text-muted-foreground">{labels.hint}</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[108px] w-full"
        role="img"
        aria-label={labels.aria}
      >
        {ticks.map((tick) => {
          const y = scaleYLog(tick, layout.lo, layout.hi, pad.t, h - pad.b);
          return (
            <g key={tick}>
              <line
                x1={pad.l}
                x2={w - pad.r}
                y1={y}
                y2={y}
                stroke="rgba(148, 163, 184, 0.14)"
                strokeWidth={1}
              />
              <text
                x={pad.l - 4}
                y={y + 3}
                textAnchor="end"
                fill="rgb(100 116 139)"
                fontSize={9}
              >
                {formatRank(tick)}
              </text>
            </g>
          );
        })}
        {axisXs.map((x, i) => (
          <line
            key={`v-${axis[i]}`}
            x1={x}
            x2={x}
            y1={pad.t}
            y2={h - pad.b}
            stroke="rgba(148, 163, 184, 0.1)"
            strokeWidth={1}
          />
        ))}
        {avgXs.length > 0 ? (
          <line
            x1={pad.l}
            x2={w - pad.r}
            y1={avgYs[avgYs.length - 1]}
            y2={avgYs[avgYs.length - 1]}
            stroke="rgb(148 163 184)"
            strokeWidth={1.4}
            strokeDasharray="4 3"
          />
        ) : null}
        {xs.length === 1 ? (
          <circle cx={xs[0]} cy={youY[0]} r={3.5} fill="#00ff87" />
        ) : (
          <>
            <polyline
              points={toPoints(xs, youY)}
              fill="none"
              stroke="#00ff87"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle
              cx={xs[xs.length - 1]}
              cy={youY[youY.length - 1]}
              r={3}
              fill="#00ff87"
            />
          </>
        )}
        {axis.map((gw, i) => (
          <text
            key={gw}
            x={axisXs[i]}
            y={h - 6}
            textAnchor="middle"
            fill="rgb(148 163 184)"
            fontSize={9}
          >
            GW{gw}
          </text>
        ))}
      </svg>
    </div>
  );
}
