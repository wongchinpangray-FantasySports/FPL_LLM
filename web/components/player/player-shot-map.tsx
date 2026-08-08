"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { UnderstatShot } from "@/lib/fpl/understat-shots";

export type PlayerShotMapLabels = {
  title: string;
  subtitle: string;
  empty: string;
  legendGoal: string;
  legendSaved: string;
  legendOther: string;
  legendSize: string;
  statShots: string;
  statGoals: string;
  statXg: string;
  statOnTarget: string;
  sourceNote: string;
};

function resultFill(result: string): "goal" | "saved" | "other" {
  if (result === "Goal") return "goal";
  if (result === "SavedShot" || result === "ShotOnPost") return "saved";
  return "other";
}

/**
 * Attacking-half shot map (goal at top). Understat X→goal, Y→width.
 */
export function PlayerShotMap({
  shots,
  totals,
  labels,
  className,
}: {
  shots: UnderstatShot[];
  totals: {
    shots: number;
    goals: number;
    xg: number;
    on_target: number;
  };
  labels: PlayerShotMapLabels;
  className?: string;
}) {
  const W = 320;
  const H = 260;
  const pad = 14;
  const pitchW = W - pad * 2;
  const pitchH = H - pad * 2;

  const plotted = useMemo(() => {
    // Prefer attacking half (X ≥ 0.5); still plot deeper shots near the half line.
    return shots.map((s) => {
      const xAtk = Math.min(1, Math.max(0, s.x));
      const y = Math.min(1, Math.max(0, s.y));
      // Goal at top: map X∈[0.45,1] → bottom→top of half.
      const xClamped = Math.max(0.45, xAtk);
      const cx = pad + y * pitchW;
      const cy = pad + ((1 - xClamped) / (1 - 0.45)) * pitchH;
      const r = 3.2 + Math.min(1, Math.max(0, s.xg)) * 14;
      return { ...s, cx, cy, r, kind: resultFill(s.result) };
    });
  }, [shots, pad, pitchW, pitchH]);

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-3">
        <h2 className="text-base font-semibold text-foreground">
          {labels.title}
        </h2>
        <p className="text-xs text-muted-foreground">{labels.subtitle}</p>
      </div>

      {shots.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="mx-auto w-full max-w-[320px] shrink-0">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full"
              role="img"
              aria-label={labels.title}
            >
              <rect
                x={pad}
                y={pad}
                width={pitchW}
                height={pitchH}
                className="fill-transparent stroke-border"
                strokeWidth={1.5}
              />
              {/* Penalty box */}
              <rect
                x={pad + pitchW * 0.21}
                y={pad}
                width={pitchW * 0.58}
                height={pitchH * 0.42}
                className="fill-transparent stroke-border"
                strokeWidth={1}
              />
              {/* Six-yard */}
              <rect
                x={pad + pitchW * 0.36}
                y={pad}
                width={pitchW * 0.28}
                height={pitchH * 0.16}
                className="fill-transparent stroke-border"
                strokeWidth={1}
              />
              {/* Goal line marker */}
              <line
                x1={pad + pitchW * 0.42}
                y1={pad}
                x2={pad + pitchW * 0.58}
                y2={pad}
                className="stroke-foreground"
                strokeWidth={3}
              />
              <circle
                cx={pad + pitchW * 0.5}
                cy={pad + pitchH * 0.28}
                r={2}
                className="fill-muted-foreground/60"
              />

              {plotted.map((s) => (
                <circle
                  key={s.id}
                  cx={s.cx}
                  cy={s.cy}
                  r={s.r}
                  className={
                    s.kind === "goal"
                      ? "fill-brand-accent/90 stroke-brand-accent"
                      : s.kind === "saved"
                        ? "fill-amber-400/70 stroke-amber-300/80"
                        : "fill-muted-foreground/45 stroke-muted-foreground/50"
                  }
                  strokeWidth={0.8}
                >
                  <title>
                    {`${s.result} · xG ${s.xg.toFixed(2)} · ${s.minute ?? "—"}' vs ${s.opponent ?? "—"}`}
                  </title>
                </circle>
              ))}
            </svg>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-brand-accent" />
                {labels.legendGoal}
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400/80" />
                {labels.legendSaved}
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-muted-foreground/50" />
                {labels.legendOther}
              </span>
              <span className="w-full sm:w-auto">{labels.legendSize}</span>
            </div>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            <Stat label={labels.statShots} value={String(totals.shots)} />
            <Stat label={labels.statGoals} value={String(totals.goals)} />
            <Stat label={labels.statXg} value={totals.xg.toFixed(2)} />
            <Stat
              label={labels.statOnTarget}
              value={String(totals.on_target)}
            />
            <p className="col-span-2 text-[11px] leading-relaxed text-muted-foreground sm:col-span-4 lg:col-span-2">
              {labels.sourceNote}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-input/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
