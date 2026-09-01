"use client";

import { cn } from "@/lib/utils";
import { getFplShirtUrl } from "@/lib/team-themes";
import type { PriceForecastStatus } from "@/lib/fpl/insights/price-forecast";
import type { SquadPlayerSignal } from "@/lib/transfers/diagnose";
import { forwardRef, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { PlannerPickPayload } from "./types";

export type PlannerGwStripCell = { gw: number; opp: string; xp: number };

function sortBySlot(rows: PlannerPickPayload[]): PlannerPickPayload[] {
  return [...rows].sort((a, b) => a.slot - b.slot);
}

const GW_STRIP_MAX = 5;

function stripXpLabel(xp: unknown): string {
  return typeof xp === "number" && Number.isFinite(xp) ? xp.toFixed(1) : "–";
}

function GwStripRow({ cells }: { cells: PlannerGwStripCell[] }) {
  const n = Math.min(GW_STRIP_MAX, cells.length);
  const shown = cells.slice(0, GW_STRIP_MAX);
  if (shown.length === 0) return null;
  return (
    <div
      className="mt-0.5 w-full border-t border-white/15 pt-0.5"
      title={shown
        .map((c) => `GW${c.gw} ${c.opp} ${stripXpLabel(c.xp)} xP`)
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
            key={`${c.gw}-${c.opp}`}
            className="flex min-w-0 flex-col items-center justify-start gap-px leading-none"
          >
            <span className="text-[5px] font-medium text-white/55 sm:text-[6px]">
              {c.gw}
            </span>
            <span
              className="max-w-full truncate text-[5px] text-white/70 sm:text-[6px]"
              title={`GW${c.gw} ${c.opp}`}
            >
              {c.opp}
            </span>
            <span className="text-[6px] font-semibold tabular-nums text-brand-accent/95 sm:text-[7px]">
              {stripXpLabel(c.xp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type PitchPriceBadge = {
  status: PriceForecastStatus;
  cost_change_event: number;
  progress: number;
};

function pitchPriceTextTone(
  badge: PitchPriceBadge | undefined,
): string {
  if (!badge) return "text-white/70";

  const changed = Math.abs(badge.cost_change_event) >= 0.05;
  if (changed) {
    return badge.cost_change_event > 0
      ? "font-semibold text-emerald-300"
      : "font-semibold text-red-300";
  }

  switch (badge.status) {
    case "likely_rise":
      return "font-semibold text-emerald-300";
    case "watch_rise":
      return "font-medium text-emerald-400/95";
    case "likely_fall":
      return "font-semibold text-red-300";
    case "watch_fall":
      return "font-medium text-red-400/95";
    default:
      return "text-white/70";
  }
}

function pitchPriceArrow(badge: PitchPriceBadge | undefined): "↑" | "↓" | null {
  if (!badge) return null;
  const changed = Math.abs(badge.cost_change_event) >= 0.05;
  if (
    badge.status === "likely_rise" ||
    badge.status === "watch_rise" ||
    (changed && badge.cost_change_event > 0)
  ) {
    return "↑";
  }
  if (
    badge.status === "likely_fall" ||
    badge.status === "watch_fall" ||
    (changed && badge.cost_change_event < 0)
  ) {
    return "↓";
  }
  return null;
}

function attentionDotClass(severity: SquadPlayerSignal["severity"]): string {
  switch (severity) {
    case "alert":
      return "bg-rose-500";
    case "watch":
      return "bg-amber-400";
    case "info":
      return "bg-slate-400/90";
    default:
      return "";
  }
}

function formTextTone(form: number, lowForm: boolean): string {
  if (lowForm || form < 3) return "text-amber-300";
  if (form >= 5) return "text-emerald-300/90";
  return "text-white/65";
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
  priceBadge,
  priceBadgeLabel,
  priceAlreadyChangedLabel,
  attention,
  onClick,
  onInspectPlayer,
  inspectNameTitle,
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
  priceBadge?: PitchPriceBadge;
  priceBadgeLabel?: string;
  priceAlreadyChangedLabel?: string | null;
  attention?: SquadPlayerSignal;
  onClick?: () => void;
  onInspectPlayer?: (fplId: number) => void;
  inspectNameTitle?: string;
}) {
  const tAtt = useTranslations("transfers");
  const isC = captainId != null && p.fpl_id === captainId;
  const isV = viceId != null && p.fpl_id === viceId;
  const isEmpty = p.fpl_id <= 0;
  const shirtUrl = !isEmpty ? getFplShirtUrl(p.team, p.position) : null;
  const [shirtFailed, setShirtFailed] = useState(false);
  const showShirt = Boolean(shirtUrl && !shirtFailed);

  const hasStrip = gwStrip != null && gwStrip.length > 0;
  /** Match horizon totals: starter captain earns double in each GW on the strip. */
  const gwStripForDisplay =
    hasStrip && gwStrip && p.is_starter && isC
      ? gwStrip.map((c) => {
          const base =
            typeof c.xp === "number" && Number.isFinite(c.xp) ? c.xp : 0;
          return {
            ...c,
            xp: Math.round(base * 2 * 10) / 10,
          };
        })
      : gwStrip;
  const nextXp =
    nextGwXpByFplId != null ? nextGwXpByFplId[p.fpl_id] : undefined;
  /** Per-GW strip already includes xP; do not duplicate next-GW xP on the bottom row. */
  const showNextXp =
    !hasStrip &&
    nextGwXpByFplId != null &&
    nextXp !== undefined &&
    Number.isFinite(nextXp);
  const showPrice = !showNextXp && !isEmpty;
  const priceTrendTitle = [priceBadgeLabel, priceAlreadyChangedLabel]
    .filter(Boolean)
    .join(" · ");
  const priceArrow = showPrice ? pitchPriceArrow(priceBadge) : null;
  const priceTone = showPrice ? pitchPriceTextTone(priceBadge) : "text-white/70";

  const showAttentionDot =
    attention != null && attention.severity !== "none";
  const lowFormFlag = attention?.kinds.includes("low_form") ?? false;
  const attentionTitle =
    attention && showAttentionDot
      ? [
          ...attention.kinds.map((k) => tAtt(`kind_${k}`)),
          ...attention.notes,
          attention.form != null ? `Form ${attention.form.toFixed(1)}` : null,
          attention.xp_horizon != null
            ? `xP ${attention.xp_horizon.toFixed(1)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined;

  const sublineParts: string[] = [];
  if (hasStrip) {
    /* fixture strip replaces subline row */
  } else if (cardSubline) {
    sublineParts.push(cardSubline);
  } else if (!isEmpty) {
    sublineParts.push(p.team ?? "–");
  }

  const inner = (
    <>
      <div className="relative mx-auto w-fit">
        {showShirt ? (
          <img
            data-pitch-shirt=""
            src={shirtUrl!}
            alt=""
            width={66}
            height={87}
            loading="eager"
            decoding="sync"
            crossOrigin="anonymous"
            className="mx-auto h-12 w-auto select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)] sm:h-14"
            onError={() => setShirtFailed(true)}
          />
        ) : !isEmpty ? (
          <div
            aria-hidden
            className="mx-auto flex h-12 w-9 items-center justify-center rounded-sm bg-black/40 text-[10px] font-bold text-white/50 sm:h-14 sm:w-10"
          >
            ?
          </div>
        ) : null}
        {showAttentionDot ? (
          <span
            data-png-skip=""
            className={cn(
              "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-black/50 sm:h-3 sm:w-3",
              attentionDotClass(attention!.severity),
            )}
            title={attentionTitle}
            aria-label={attentionTitle}
          />
        ) : null}
      </div>
      <div
        className={cn(
          "mt-0.5 w-full min-w-0 rounded-sm px-0.5 py-0.5",
          !isEmpty && "bg-black/55 backdrop-blur-[2px]",
        )}
      >
        {!isEmpty && onInspectPlayer ? (
          <button
            type="button"
            title={inspectNameTitle}
            className="w-full truncate text-center text-[8px] font-semibold leading-tight text-white underline decoration-brand-accent/40 underline-offset-2 hover:text-brand-accent sm:text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              onInspectPlayer(p.fpl_id);
            }}
          >
            {p.web_name ?? `#${p.fpl_id}`}
          </button>
        ) : (
          <div className="truncate text-center text-[8px] font-semibold leading-tight text-white sm:text-[10px]">
            {isEmpty ? (p.web_name ?? "–") : (p.web_name ?? `#${p.fpl_id}`)}
          </div>
        )}
        {hasStrip && gwStripForDisplay ? (
          <GwStripRow cells={gwStripForDisplay} />
        ) : (
          <div className="truncate text-center text-[7px] sm:text-[9px]">
            {!isEmpty ? (
              <>
                {sublineParts.length > 0 ? (
                  <span className="text-white/70">{sublineParts.join(" · ")}</span>
                ) : (
                  <span className="text-white/70">{p.team ?? "–"}</span>
                )}
                {attention?.form != null ? (
                  <>
                    <span className="text-white/50"> · </span>
                    <span
                      className={cn(
                        "tabular-nums",
                        formTextTone(attention.form, lowFormFlag),
                      )}
                    >
                      F {attention.form.toFixed(1)}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <span className="text-white/70">{p.position ?? "–"}</span>
            )}
          </div>
        )}
        <div className="mt-0.5 flex items-center justify-center gap-0.5 sm:gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-px tabular-nums",
              showNextXp
                ? "text-[7px] font-semibold text-brand-accent/95 sm:text-[9px]"
                : showPrice
                  ? cn("text-[8px] sm:text-[10px]", priceTone)
                  : "text-[7px] text-white/70 sm:text-[9px]",
            )}
            title={
              showNextXp
                ? nextGwXpTitle
                : showPrice && priceTrendTitle
                  ? priceTrendTitle
                  : undefined
            }
          >
            {isEmpty
              ? "–"
              : showNextXp && nextXp != null && Number.isFinite(nextXp)
                ? nextXp.toFixed(1)
                : `£${p.base_price != null ? p.base_price.toFixed(1) : "?"}m`}
            {priceArrow ? (
              <span aria-hidden className="font-bold leading-none">
                {priceArrow}
              </span>
            ) : null}
          </span>
          {isC && (
            <span className="rounded bg-brand-accent/30 px-0.5 text-[7px] font-bold text-brand-accent sm:px-1 sm:text-[8px]">
              C
            </span>
          )}
          {isV && !isC && (
            <span className="rounded bg-white/15 px-0.5 text-[7px] text-white/80 sm:px-1 sm:text-[8px]">
              V
            </span>
          )}
        </div>
      </div>
    </>
  );

  const cls = cn(
    "flex min-w-[48px] max-w-[min(24vw,76px)] shrink flex-col items-center text-center transition-[filter,transform] sm:min-w-[76px] sm:max-w-[108px]",
    hasStrip &&
      "min-w-[56px] max-w-[min(30vw,96px)] sm:min-w-[92px] sm:max-w-[124px]",
    isEmpty
      ? "rounded-md border border-dashed border-white/25 bg-black/30 px-0.5 py-1.5 backdrop-blur-[2px]"
      : "border-0 bg-transparent p-0 shadow-none",
    highlight &&
      "rounded-md ring-2 ring-amber-400 ring-offset-1 ring-offset-emerald-950 sm:ring-offset-2",
    selectedForReorder &&
      "z-[1] rounded-md ring-2 ring-sky-400 ring-offset-1 ring-offset-emerald-950 sm:ring-offset-2",
    interactive && !isEmpty && "cursor-pointer hover:brightness-110",
    interactive &&
      isEmpty &&
      "cursor-pointer hover:border-brand-accent/50 hover:bg-black/45",
  );

  if (interactive && onClick && onInspectPlayer) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cls}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {inner}
      </div>
    );
  }

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
  priceBadgeByFplId,
  priceBadgeLabelByFplId,
  priceAlreadyChangedByFplId,
  attentionByFplId,
  onPickSlot,
  onInspectPlayer,
  inspectNameTitle,
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
  priceBadgeByFplId?: Record<number, PitchPriceBadge>;
  priceBadgeLabelByFplId?: Record<number, string>;
  priceAlreadyChangedByFplId?: Record<number, string | null>;
  attentionByFplId?: Record<number, SquadPlayerSignal>;
  onPickSlot?: (slot: number) => void;
  onInspectPlayer?: (fplId: number) => void;
  inspectNameTitle?: string;
}) {
  if (players.length === 0) return null;
  const sorted = sortBySlot(players);
  return (
    <div className="flex min-h-[56px] flex-1 items-center justify-center gap-1 px-0 sm:min-h-[72px] sm:gap-2 sm:px-1">
      {sorted.map((p) => (
        <PlayerChip
          key={`${p.slot}-${p.fpl_id}`}
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
          priceBadge={priceBadgeByFplId?.[p.fpl_id]}
          priceBadgeLabel={priceBadgeLabelByFplId?.[p.fpl_id]}
          priceAlreadyChangedLabel={priceAlreadyChangedByFplId?.[p.fpl_id]}
          attention={attentionByFplId?.[p.fpl_id]}
          onClick={onPickSlot ? () => onPickSlot(p.slot) : undefined}
          onInspectPlayer={onInspectPlayer}
          inspectNameTitle={inspectNameTitle}
        />
      ))}
    </div>
  );
}

function PitchMarkings({
  gkAtTop,
  showcase = false,
}: {
  gkAtTop: boolean;
  showcase?: boolean;
}) {
  const boxSide = gkAtTop ? "top" : "bottom";
  const farSide = gkAtTop ? "bottom" : "top";
  const boxPos =
    boxSide === "bottom"
      ? "bottom-2 sm:bottom-3"
      : "top-2 sm:top-3";
  const farPos =
    farSide === "bottom"
      ? "bottom-[38%] sm:bottom-[36%]"
      : "top-[38%] sm:top-[36%]";
  const line = showcase ? "border-white/35" : "border-white/25";
  const soft = showcase ? "border-white/28" : "border-white/20";

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-2 rounded-sm border sm:inset-3",
          line,
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 sm:left-3 sm:right-3",
          showcase ? "bg-white/35" : "bg-white/25",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 h-[24%] w-[20%] -translate-x-1/2 -translate-y-1/2 rounded-full border",
          line,
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
          showcase ? "bg-white/50 shadow-[0_0_10px_rgba(255,255,255,0.35)]" : "bg-white/35",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 h-[18%] w-[42%] -translate-x-1/2 border",
          soft,
          boxPos,
          "border-b-0 sm:border-b-0",
          boxSide === "bottom" ? "rounded-t-sm" : "rounded-b-sm border-t-0",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 h-[8%] w-[18%] -translate-x-1/2 border border-white/15",
          boxPos,
          boxSide === "bottom" ? "rounded-t-sm border-b-0" : "rounded-b-sm border-t-0",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 h-[10%] w-[28%] -translate-x-1/2 border border-white/10",
          farPos,
          farSide === "bottom" ? "rounded-t-sm border-b-0" : "rounded-b-sm border-t-0",
        )}
      />
    </>
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
  /** Click player name to open FPL performance detail */
  onInspectPlayer?: (fplId: number) => void;
  inspectNameTitle?: string;
  /** Richer grass / markings for dashboard showcase */
  appearance?: "default" | "showcase";
  /** Price trend badges (dashboard squad overview) */
  priceBadgeByFplId?: Record<number, PitchPriceBadge>;
  priceBadgeLabelByFplId?: Record<number, string>;
  priceAlreadyChangedByFplId?: Record<number, string | null>;
  /** Squad diagnosis markers (injury, form, xP, fixture). */
  attentionByFplId?: Record<number, SquadPlayerSignal>;
  /** Show legend when any player has a non-none severity. */
  showAttentionLegend?: boolean;
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
      onInspectPlayer,
      inspectNameTitle,
      appearance = "default",
      priceBadgeByFplId,
      priceBadgeLabelByFplId,
      priceAlreadyChangedByFplId,
      attentionByFplId,
      showAttentionLegend = false,
    },
    ref,
  ) {
    const tAtt = useTranslations("transfers");
    const hasAttentionMarkers = useMemo(() => {
      if (!attentionByFplId) return false;
      return Object.values(attentionByFplId).some((s) => s.severity !== "none");
    }, [attentionByFplId]);
    const showLegend = showAttentionLegend && hasAttentionMarkers;
    const starters = picks.filter((p) => p.is_starter);
    const benchAll = sortBySlot(picks.filter((p) => !p.is_starter));
    /** Bench GK in a fixed column so it does not jump when outfield bench order changes (slot sort). */
    const benchGk = benchAll.filter((p) => p.position === "GKP");
    const benchOutfield = benchAll.filter((p) => p.position !== "GKP");

    const gk = starters.filter((p) => p.position === "GKP");
    const defs = starters.filter((p) => p.position === "DEF");
    const mids = starters.filter((p) => p.position === "MID");
    const fwds = starters.filter((p) => p.position === "FWD");
    const showcase = appearance === "showcase";

    return (
      <div ref={ref} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-foreground sm:text-sm">{title}</h3>
            {caption ? (
              <p className="text-[10px] text-muted-foreground sm:text-[11px]">{caption}</p>
            ) : null}
          </div>
          {titleAction ? (
            <div className="shrink-0 pt-0.5" data-png-skip="">
              {titleAction}
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "overflow-hidden rounded-xl border sm:rounded-2xl",
            showcase
              ? "border-emerald-500/35 shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]"
              : "border-emerald-800/50 shadow-[0_8px_32px_rgba(0,0,0,0.35)]",
          )}
        >
          <div
            className={cn(
              "relative flex flex-col justify-between gap-0.5 px-1 py-2 sm:gap-1 sm:px-2 sm:py-3",
              // Content-driven height so large kit shirts are not clipped.
              showcase
                ? "min-h-[380px] sm:min-h-[460px]"
                : "min-h-[360px] sm:min-h-[440px]",
            )}
            style={{
              backgroundImage: showcase
                ? [
                    "radial-gradient(ellipse 80% 55% at 50% 42%, rgba(52,211,153,0.14), transparent 70%)",
                    "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0, rgba(0,0,0,0.12) 11%, rgba(255,255,255,0.045) 11%, rgba(255,255,255,0.045) 22%)",
                    "linear-gradient(160deg, rgb(6 95 72), rgb(4 62 50) 45%, rgb(5 78 62))",
                  ].join(", ")
                : [
                    "repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 12%)",
                    "linear-gradient(to bottom, rgb(5 70 55), rgb(4 58 48), rgb(5 70 55))",
                  ].join(", "),
            }}
          >
            <PitchMarkings gkAtTop={gkAtTop} showcase={showcase} />

            {/* XI rows: FWD → MID → DEF → GK (bottom) when gkAtTop=false. */}
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
                priceBadgeByFplId={priceBadgeByFplId}
                priceBadgeLabelByFplId={priceBadgeLabelByFplId}
                priceAlreadyChangedByFplId={priceAlreadyChangedByFplId}
                attentionByFplId={attentionByFplId}
                onPickSlot={onPickSlot}
                onInspectPlayer={onInspectPlayer}
                inspectNameTitle={inspectNameTitle}
              />
            ))}
          </div>

          {/* Bench */}
          <div
            className={cn(
              "border-t px-1 py-1 sm:px-2 sm:py-2",
              showcase
                ? "border-emerald-400/15 bg-gradient-to-b from-black/50 to-black/70"
                : "border-white/10 bg-black/40",
            )}
          >
            <div className="mb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground sm:mb-1 sm:text-[10px]">
              {benchLabel}
            </div>
            {/*
            Four fixed bench slots (FPL always has 4 subs): one column each so GK
            and outfield stay aligned without a gap in the middle.
          */}
            <div className="grid grid-cols-4 items-end justify-items-center gap-0.5 sm:gap-2">
              {benchGk.length > 0 ? (
                <div className="flex w-full max-w-[min(24vw,76px)] flex-col items-center justify-self-center gap-0.5 sm:max-w-[108px]">
                  <span className="text-[8px] uppercase tracking-wide text-muted-foreground/80 sm:text-[9px]">
                    {benchGkAbbrev}
                  </span>
                  <PlayerChip
                    key={`${benchGk[0].slot}-${benchGk[0].fpl_id}`}
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
                    priceBadge={priceBadgeByFplId?.[benchGk[0].fpl_id]}
                    priceBadgeLabel={priceBadgeLabelByFplId?.[benchGk[0].fpl_id]}
                    priceAlreadyChangedLabel={
                      priceAlreadyChangedByFplId?.[benchGk[0].fpl_id]
                    }
                    attention={attentionByFplId?.[benchGk[0].fpl_id]}
                    onClick={
                      onPickSlot
                        ? () => onPickSlot(benchGk[0].slot)
                        : undefined
                    }
                    onInspectPlayer={onInspectPlayer}
                    inspectNameTitle={inspectNameTitle}
                  />
                </div>
              ) : null}
              {benchOutfield.map((p) => (
                <div
                  key={`${p.slot}-${p.fpl_id}`}
                  className="flex w-full max-w-[min(24vw,76px)] flex-col items-center justify-self-center sm:max-w-[108px]"
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
                    priceBadge={priceBadgeByFplId?.[p.fpl_id]}
                    priceBadgeLabel={priceBadgeLabelByFplId?.[p.fpl_id]}
                    priceAlreadyChangedLabel={
                      priceAlreadyChangedByFplId?.[p.fpl_id]
                    }
                    attention={attentionByFplId?.[p.fpl_id]}
                    onClick={onPickSlot ? () => onPickSlot(p.slot) : undefined}
                    onInspectPlayer={onInspectPlayer}
                    inspectNameTitle={inspectNameTitle}
                  />
                </div>
              ))}
            </div>
          </div>
          {showLegend ? (
            <div
              data-png-skip=""
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 px-2 py-1.5 text-[9px] text-white/60 sm:text-[10px]"
            >
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
                {tAtt("pitchLegendAlert")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                {tAtt("pitchLegendWatch")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-400/90" aria-hidden />
                {tAtt("pitchLegendInfo")}
              </span>
              <span className="text-white/45">{tAtt("pitchLegendFormHint")}</span>
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);
