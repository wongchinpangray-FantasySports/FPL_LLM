"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type ReactNode } from "react";
import type { PlannerPickPayload } from "./types";

export type PlannerGwStripCell = { gw: number; opp: string; xp: number };

function sortBySlot(rows: PlannerPickPayload[]): PlannerPickPayload[] {
  return [...rows].sort((a, b) => a.slot - b.slot);
}

const GW_STRIP_MAX = 5;

function GwStripRow({ cells }: { cells: PlannerGwStripCell[] }) {
  const n = Math.min(GW_STRIP_MAX, cells.length);
  const shown = cells.slice(0, GW_STRIP_MAX);
  if (shown.length === 0) return null;
  return (
    <div
      className="mt-0.5 w-full border-t border-white/10 pt-0.5"
      title={shown
        .map((c) => `GW${c.gw} ${c.opp} ${c.xp.toFixed(1)} xP`)
        .join(" · ")}
    >
      <div
        className="grid w-full gap-px"
        style={{
          gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
        }}
      >
        {shown.map((c) => (
          <div
            key={c.gw}
            className="flex min-w-0 flex-col items-center justify-start gap-px leading-none"
          >
            <span className="text-[5px] font-medium text-slate-500 sm:text-[6px]">
              {c.gw}
            </span>
            <span
              className="max-w-full truncate text-[5px] text-slate-400 sm:text-[6px]"
              title={`GW${c.gw} ${c.opp}`}
            >
              {c.opp}
            </span>
            <span className="text-[6px] font-semibold tabular-nums text-brand-accent/95 sm:text-[7px]">
              {c.xp.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerChip({
  p,
  captainId,
  viceId,
  highlight,
  selectedForReorder,
  interactive,
  cardSubline,
  gwStrip,
  nextGwXpByFplId,
  nextGwXpTitle,
  onClick,
}: {
  p: PlannerPickPayload;
  captainId: number | null;
  viceId: number | null;
  highlight?: boolean;
  /** First selection in Bench ↔ XI mode */
  selectedForReorder?: boolean;
  interactive?: boolean;
  /** Second line under name when no projection strip */
  cardSubline?: string;
  /** Upcoming GWs (fixtures + xP) after Refresh xP */
  gwStrip?: PlannerGwStripCell[];
  /** When set and no GW strip, show next-GW xP (values may include captain ×2) instead of £ */
  nextGwXpByFplId?: Record<number, number>;
  nextGwXpTitle?: string;
  onClick?: () => void;
}) {
  const isC = captainId != null && p.fpl_id === captainId;
  const isV = viceId != null && p.fpl_id === viceId;

  const hasStrip = gwStrip != null && gwStrip.length > 0;
  /** Match horizon totals: starter captain earns double in each GW on the strip. */
  const gwStripForDisplay =
    hasStrip && gwStrip && p.is_starter && isC
      ? gwStrip.map((c) => ({
          ...c,
          xp: Math.round(c.xp * 2 * 10) / 10,
        }))
      : gwStrip;
  const nextXp =
    nextGwXpByFplId != null ? nextGwXpByFplId[p.fpl_id] : undefined;
  /** Per-GW strip already includes xP; do not duplicate next-GW xP on the bottom row. */
  const showNextXp =
    !hasStrip &&
    nextGwXpByFplId != null &&
    nextXp !== undefined &&
    Number.isFinite(nextXp);

  const inner = (
    <>
      <div className="truncate text-[8px] font-semibold leading-tight text-white sm:text-[10px]">
        {p.web_name ?? `#${p.fpl_id}`}
      </div>
      {hasStrip && gwStripForDisplay ? (
        <GwStripRow cells={gwStripForDisplay} />
      ) : (
        <div className="truncate text-[7px] text-slate-400 sm:text-[9px]">
          {cardSubline ?? p.team ?? "–"}
        </div>
      )}
      <div className="mt-0.5 flex items-center justify-center gap-0.5 sm:gap-1">
        <span
          className={cn(
            "text-[7px] tabular-nums sm:text-[9px]",
            showNextXp
              ? "font-semibold text-brand-accent/95"
              : "text-slate-500",
          )}
          title={showNextXp ? nextGwXpTitle : undefined}
        >
          {showNextXp
            ? nextXp!.toFixed(1)
            : `£${p.base_price != null ? p.base_price.toFixed(1) : "?"}m`}
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
    hasStrip &&
      "min-w-[52px] max-w-[min(28vw,88px)] sm:min-w-[88px] sm:max-w-[118px]",
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
  cardSublineByFplId,
  gwForecastByFplId,
  nextGwXpByFplId,
  nextGwXpTitle,
  onPickSlot,
}: {
  players: PlannerPickPayload[];
  captainId: number | null;
  viceId: number | null;
  highlightSlots?: Set<number>;
  reorderSelectedSlot?: number | null;
  interactive?: boolean;
  cardSublineByFplId?: Record<number, string>;
  gwForecastByFplId?: Record<number, PlannerGwStripCell[]>;
  nextGwXpByFplId?: Record<number, number>;
  nextGwXpTitle?: string;
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
          cardSubline={cardSublineByFplId?.[p.fpl_id]}
          gwStrip={gwForecastByFplId?.[p.fpl_id]}
          nextGwXpByFplId={nextGwXpByFplId}
          nextGwXpTitle={nextGwXpTitle}
          onClick={onPickSlot ? () => onPickSlot(p.slot) : undefined}
        />
      ))}
    </div>
  );
}

export type PitchViewProps = {
  picks: PlannerPickPayload[];
  title: string;
  caption?: string;
  captainId: number | null;
  viceId: number | null;
  highlightSlots?: Set<number>;
  reorderSelectedSlot?: number | null;
  interactive?: boolean;
  onPickSlot?: (slot: number) => void;
  benchLabel?: string;
  benchGkAbbrev?: string;
  cardSublineByFplId?: Record<number, string>;
  /** After Refresh xP: up to 5 GWs fixture + xP per player */
  gwForecastByFplId?: Record<number, PlannerGwStripCell[]>;
  nextGwXpByFplId?: Record<number, number>;
  nextGwXpTitle?: string;
  gkAtTop?: boolean;
  /** Optional actions (e.g. export) aligned with title row */
  titleAction?: ReactNode;
};

export const PitchView = forwardRef<HTMLDivElement, PitchViewProps>(
  function PitchView(
    {
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
      cardSublineByFplId,
      gwForecastByFplId,
      nextGwXpByFplId,
      nextGwXpTitle,
      gkAtTop = true,
      titleAction,
    },
    ref,
  ) {
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
      <div ref={ref} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-white sm:text-sm">{title}</h3>
            {caption ? (
              <p className="text-[10px] text-slate-500 sm:text-[11px]">{caption}</p>
            ) : null}
          </div>
          {titleAction ? (
            <div className="shrink-0 pt-0.5">{titleAction}</div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-emerald-700/50 bg-gradient-to-b from-emerald-950 via-emerald-900/95 to-emerald-950 shadow-lg sm:rounded-2xl">
          {/* Decorative centre line */}
          <div className="relative aspect-[5/2.55] flex flex-col justify-between px-1 py-1.5 sm:aspect-[5/3.1] sm:px-2 sm:py-3">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 -translate-y-1/2 bg-white/10" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />

            {/* XI rows: GK → DEF → MID → FWD (top to bottom); pass gkAtTop={false} for attack-first. */}
            {(gkAtTop
              ? [
                  { key: "gk", players: gk },
                  { key: "def", players: defs },
                  { key: "mid", players: mids },
                  { key: "fwd", players: fwds },
                ]
              : [
                  { key: "fwd", players: fwds },
                  { key: "mid", players: mids },
                  { key: "def", players: defs },
                  { key: "gk", players: gk },
                ]
            ).map(({ key, players }) => (
              <Line
                key={key}
                players={players}
                captainId={captainId}
                viceId={viceId}
                highlightSlots={highlightSlots}
                reorderSelectedSlot={reorderSelectedSlot}
                interactive={interactive}
                cardSublineByFplId={cardSublineByFplId}
                gwForecastByFplId={gwForecastByFplId}
                nextGwXpByFplId={nextGwXpByFplId}
                nextGwXpTitle={nextGwXpTitle}
                onPickSlot={onPickSlot}
              />
            ))}
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
            <div className="grid grid-cols-4 items-end justify-items-center gap-0.5 sm:gap-2">
              {benchGk.length > 0 ? (
                <div className="flex w-full max-w-[min(22vw,68px)] flex-col items-center justify-self-center gap-0.5 sm:max-w-[100px]">
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
                    cardSubline={cardSublineByFplId?.[benchGk[0].fpl_id]}
                    gwStrip={gwForecastByFplId?.[benchGk[0].fpl_id]}
                    nextGwXpByFplId={nextGwXpByFplId}
                    nextGwXpTitle={nextGwXpTitle}
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
                    cardSubline={cardSublineByFplId?.[p.fpl_id]}
                    gwStrip={gwForecastByFplId?.[p.fpl_id]}
                    nextGwXpByFplId={nextGwXpByFplId}
                    nextGwXpTitle={nextGwXpTitle}
                    onClick={onPickSlot ? () => onPickSlot(p.slot) : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
