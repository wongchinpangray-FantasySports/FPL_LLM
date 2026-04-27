"use client";

import { cn } from "@/lib/utils";
import type { PlannerPickPayload } from "./types";

function sortBySlot(rows: PlannerPickPayload[]): PlannerPickPayload[] {
  return [...rows].sort((a, b) => a.slot - b.slot);
}

function PlayerChip({
  p,
  captainId,
  viceId,
  highlight,
  selectedForReorder,
  interactive,
  onClick,
}: {
  p: PlannerPickPayload;
  captainId: number | null;
  viceId: number | null;
  highlight?: boolean;
  /** First selection in Bench ↔ XI mode */
  selectedForReorder?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const isC = captainId != null && p.fpl_id === captainId;
  const isV = viceId != null && p.fpl_id === viceId;

  const inner = (
    <>
      <div className="truncate text-[8px] font-semibold leading-tight text-white sm:text-[10px]">
        {p.web_name ?? `#${p.fpl_id}`}
      </div>
      <div className="truncate text-[7px] text-slate-400 sm:text-[9px]">{p.team}</div>
      <div className="mt-0.5 flex items-center justify-center gap-0.5 sm:gap-1">
        <span className="text-[7px] text-slate-500 sm:text-[9px]">
          £{p.base_price != null ? p.base_price.toFixed(1) : "?"}m
        </span>
        {isC && (
          <span className="rounded bg-brand-accent/25 px-0.5 text-[7px] font-bold text-brand-accent sm:px-1 sm:text-[8px]">
            C
          </span>
        )}
        {isV && !isC && (
          <span className="rounded bg-white/15 px-0.5 text-[7px] text-slate-300 sm:px-1 sm:text-[8px]">
            V
          </span>
        )}
      </div>
    </>
  );

  const cls = cn(
    "min-w-[44px] max-w-[min(22vw,68px)] shrink rounded-md border px-0.5 py-0.5 text-center shadow-sm transition-colors sm:min-w-[72px] sm:max-w-[100px] sm:rounded-lg sm:px-1.5 sm:py-1.5",
    "border-white/20 bg-black/40 backdrop-blur-sm",
    highlight &&
      "ring-2 ring-amber-400 ring-offset-1 ring-offset-emerald-950 shadow-[0_0_12px_rgba(251,191,36,0.25)] sm:ring-offset-2",
    selectedForReorder &&
      "ring-2 ring-sky-400 ring-offset-1 ring-offset-emerald-950 sm:ring-offset-2 z-[1]",
    interactive && "hover:border-brand-accent/50 hover:bg-black/55 cursor-pointer",
  );

  if (interactive && onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className={cls}>{inner}</div>;
}

function Line({
  players,
  captainId,
  viceId,
  highlightSlots,
  reorderSelectedSlot,
  interactive,
  onPickSlot,
}: {
  players: PlannerPickPayload[];
  captainId: number | null;
  viceId: number | null;
  highlightSlots?: Set<number>;
  reorderSelectedSlot?: number | null;
  interactive?: boolean;
  onPickSlot?: (slot: number) => void;
}) {
  if (players.length === 0) return null;
  const sorted = sortBySlot(players);
  return (
    <div className="flex min-h-[36px] flex-1 items-center justify-center gap-0.5 px-0 sm:min-h-[52px] sm:gap-1.5 sm:px-1">
      {sorted.map((p) => (
        <PlayerChip
          key={p.slot}
          p={p}
          captainId={captainId}
          viceId={viceId}
          highlight={highlightSlots?.has(p.slot)}
          selectedForReorder={reorderSelectedSlot === p.slot}
          interactive={interactive}
          onClick={onPickSlot ? () => onPickSlot(p.slot) : undefined}
        />
      ))}
    </div>
  );
}

export function PitchView({
  picks,
  title,
  caption,
  captainId,
  viceId,
  highlightSlots,
  reorderSelectedSlot,
  interactive,
  onPickSlot,
  benchLabel = "Bench",
  benchGkAbbrev = "GK",
}: {
  picks: PlannerPickPayload[];
  title: string;
  caption?: string;
  captainId: number | null;
  viceId: number | null;
  benchLabel?: string;
  /** Label above bench goalkeeper column */
  benchGkAbbrev?: string;
  highlightSlots?: Set<number>;
  /** Highlight slot during Bench ↔ XI two-tap selection */
  reorderSelectedSlot?: number | null;
  interactive?: boolean;
  onPickSlot?: (slot: number) => void;
}) {
  const starters = picks.filter((p) => p.is_starter);
  const benchAll = sortBySlot(picks.filter((p) => !p.is_starter));
  /** Bench GK in a fixed column so it does not jump when outfield bench order changes (slot sort). */
  const benchGk = benchAll.filter((p) => p.position === "GKP");
  const benchOutfield = benchAll.filter((p) => p.position !== "GKP");

  const gk = starters.filter((p) => p.position === "GKP");
  const defs = starters.filter((p) => p.position === "DEF");
  const mids = starters.filter((p) => p.position === "MID");
  const fwds = starters.filter((p) => p.position === "FWD");

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-xs font-semibold text-white sm:text-sm">{title}</h3>
        {caption ? (
          <p className="text-[10px] text-slate-500 sm:text-[11px]">{caption}</p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-emerald-700/50 bg-gradient-to-b from-emerald-950 via-emerald-900/95 to-emerald-950 shadow-lg sm:rounded-2xl">
        {/* Decorative centre line */}
        <div className="relative aspect-[5/2.55] flex flex-col justify-between px-1 py-1.5 sm:aspect-[5/3.1] sm:px-2 sm:py-3">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 -translate-y-1/2 bg-white/10" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />

          {/* Attack → defence (top to bottom of pitch) */}
          <Line
            players={fwds}
            captainId={captainId}
            viceId={viceId}
            highlightSlots={highlightSlots}
            reorderSelectedSlot={reorderSelectedSlot}
            interactive={interactive}
            onPickSlot={onPickSlot}
          />
          <Line
            players={mids}
            captainId={captainId}
            viceId={viceId}
            highlightSlots={highlightSlots}
            reorderSelectedSlot={reorderSelectedSlot}
            interactive={interactive}
            onPickSlot={onPickSlot}
          />
          <Line
            players={defs}
            captainId={captainId}
            viceId={viceId}
            highlightSlots={highlightSlots}
            reorderSelectedSlot={reorderSelectedSlot}
            interactive={interactive}
            onPickSlot={onPickSlot}
          />
          <Line
            players={gk}
            captainId={captainId}
            viceId={viceId}
            highlightSlots={highlightSlots}
            reorderSelectedSlot={reorderSelectedSlot}
            interactive={interactive}
            onPickSlot={onPickSlot}
          />
        </div>

        {/* Bench */}
        <div className="border-t border-white/10 bg-black/25 px-1 py-1 sm:px-2 sm:py-2">
          <div className="mb-0.5 text-[9px] uppercase tracking-wide text-slate-500 sm:mb-1 sm:text-[10px]">
            {benchLabel}
          </div>
          {/*
            Four fixed bench slots (FPL always has 4 subs): one column each so GK
            and outfield stay aligned without a gap in the middle.
          */}
          <div className="grid grid-cols-4 gap-0.5 sm:gap-2 items-end justify-items-center">
            {benchGk.length > 0 ? (
              <div className="flex w-full max-w-[min(22vw,68px)] flex-col items-center gap-0.5 justify-self-center sm:max-w-[100px]">
                <span className="text-[8px] uppercase tracking-wide text-slate-600 sm:text-[9px]">
                  {benchGkAbbrev}
                </span>
                <PlayerChip
                  key={benchGk[0].slot}
                  p={benchGk[0]}
                  captainId={captainId}
                  viceId={viceId}
                  highlight={highlightSlots?.has(benchGk[0].slot)}
                  selectedForReorder={
                    reorderSelectedSlot === benchGk[0].slot
                  }
                  interactive={interactive}
                  onClick={
                    onPickSlot
                      ? () => onPickSlot(benchGk[0].slot)
                      : undefined
                  }
                />
              </div>
            ) : null}
            {benchOutfield.map((p) => (
              <div
                key={p.slot}
                className="flex w-full max-w-[min(22vw,68px)] flex-col items-center justify-self-center sm:max-w-[100px]"
              >
                <PlayerChip
                  p={p}
                  captainId={captainId}
                  viceId={viceId}
                  highlight={highlightSlots?.has(p.slot)}
                  selectedForReorder={reorderSelectedSlot === p.slot}
                  interactive={interactive}
                  onClick={onPickSlot ? () => onPickSlot(p.slot) : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
