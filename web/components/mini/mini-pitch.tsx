"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MiniPlayerDisplay } from "@/lib/mini/player-stats";
import { getFplShirtUrl, getPitchCardKitStyle } from "@/lib/team-themes";

export const MINI_SLOT_COUNT = 5;
/** Slot 0 = GK (bottom); slots 1–4 = outfield. */
export const MINI_GK_SLOT = 0;

export type MiniPitchPlayer = MiniPlayerDisplay;

function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

function statusLabel(
  status: string | null | undefined,
  t: (key: string) => string,
): string | null {
  if (!status || status === "a") return null;
  const map: Record<string, string> = {
    i: t("statusInjured"),
    d: t("statusDoubt"),
    s: t("statusSuspended"),
    u: t("statusUnavailable"),
  };
  return map[status] ?? status.toUpperCase();
}

/** Defensive half: halfway line at top, goal at bottom. */
function HalfPitchMarkings() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 72"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Touchlines + goal line */}
      <rect
        x="3.5"
        y="3.5"
        width="93"
        height="65"
        fill="none"
        stroke="rgba(255,255,255,0.32)"
        strokeWidth="0.75"
      />
      {/* Halfway line (top) */}
      <line
        x1="3.5"
        y1="3.5"
        x2="96.5"
        y2="3.5"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.9"
      />
      {/* Half centre circle opening upward from halfway */}
      <path
        d="M 36 3.5 A 14 14 0 0 0 64 3.5"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.6"
      />
      <circle cx="50" cy="3.5" r="1.05" fill="rgba(255,255,255,0.4)" />
      {/* Penalty area */}
      <rect
        x="22"
        y="44"
        width="56"
        height="24.5"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.6"
      />
      {/* Six-yard box */}
      <rect
        x="34"
        y="56.5"
        width="32"
        height="12"
        fill="none"
        stroke="rgba(255,255,255,0.24)"
        strokeWidth="0.5"
      />
      {/* Penalty spot */}
      <circle cx="50" cy="51" r="0.85" fill="rgba(255,255,255,0.35)" />
      {/* Penalty arc */}
      <path
        d="M 38 44 A 12 12 0 0 1 62 44"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.5"
      />
      {/* Goal mouth */}
      <rect
        x="42"
        y="68"
        width="16"
        height="2.2"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="0.7"
      />
      {/* Corner arcs at goal-line corners */}
      <path
        d="M3.5 65.5 Q6 68.5 6 68.5"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.45"
      />
      <path
        d="M96.5 65.5 Q94 68.5 94 68.5"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.45"
      />
    </svg>
  );
}

function PitchCard({
  slotIndex,
  player,
  slotLabel,
  captainId,
  viceId,
  active,
  disabled,
  readOnly,
  showGwPoints,
  compact,
  fixtureLabel,
  onSlotClick,
  onSetCaptain,
  onSetVice,
  captainLabel,
  viceLabel,
  emptyLabel,
  miniOwnedPct,
}: {
  slotIndex: number;
  player: MiniPitchPlayer | null;
  slotLabel: string;
  captainId: number | null;
  viceId: number | null;
  active: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  showGwPoints?: boolean;
  compact?: boolean;
  fixtureLabel?: string | null;
  onSlotClick: (slotIndex: number) => void;
  onSetCaptain: (fplId: number) => void;
  onSetVice: (fplId: number) => void;
  captainLabel: string;
  viceLabel: string;
  emptyLabel: string;
  miniOwnedPct: number | null;
}) {
  const t = useTranslations("mini");
  const filled = player != null;
  const isC = filled && captainId === player.fpl_id;
  const isV = filled && viceId === player.fpl_id;
  const name = player?.web_name ?? null;
  const status = filled ? statusLabel(player.status, t) : null;
  const interactive = !disabled && !readOnly;
  const inspectMode = Boolean(readOnly && showGwPoints);
  const kit = filled ? getPitchCardKitStyle(player.team) : null;
  const shirtUrl = filled
    ? getFplShirtUrl(player.team, player.position)
    : null;
  const [shirtFailed, setShirtFailed] = useState(false);
  const showShirt = Boolean(shirtUrl && !shirtFailed);

  const cardCls = cn(
    "group relative w-full overflow-hidden rounded-xl text-left transition-all duration-200",
    "shadow-[0_8px_18px_rgba(0,0,0,0.32)]",
    filled
      ? inspectMode
        ? "ring-1 ring-white/20"
        : "bg-gradient-to-b from-[#1a2430] via-[#121820] to-[#0b1016] ring-1 ring-white/15"
      : "border border-dashed border-white/35 bg-black/25",
    interactive &&
      "cursor-pointer hover:-translate-y-0.5 hover:scale-[1.02] hover:ring-white/35",
    active && "ring-2 ring-[#7dffa8] ring-offset-2 ring-offset-[#0d3b24]",
  );

  const cardBody = (
    <>
      {filled && !inspectMode ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "linear-gradient(135deg, rgba(125,255,168,0.12) 0%, transparent 42%, rgba(255,255,255,0.04) 100%)",
          }}
        />
      ) : null}

      {filled && inspectMode && kit ? (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: kit.background }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1"
            style={{ background: kit.topBar }}
          />
        </>
      ) : null}

      {filled ? (
        inspectMode ? (
          <div
            className={cn(
              "relative flex flex-col items-center",
              compact
                ? "px-1 pb-1.5 pt-1.5"
                : "px-1.5 pb-2 pt-2 sm:px-2 sm:pb-2.5 sm:pt-2.5",
            )}
          >
            <div className="absolute right-1 top-1 flex items-center gap-0.5">
              {isC ? (
                <span className="rounded-full bg-[#7dffa8] px-1.5 py-0.5 text-[8px] font-black text-[#062016] shadow sm:text-[9px]">
                  C
                </span>
              ) : null}
              {isV && !isC ? (
                <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[8px] font-bold text-white sm:text-[9px]">
                  V
                </span>
              ) : null}
            </div>

            {showShirt ? (
              <img
                src={shirtUrl!}
                alt=""
                width={66}
                height={87}
                loading="lazy"
                decoding="async"
                className={cn(
                  "w-auto select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]",
                  compact ? "h-8 sm:h-9" : "h-11 sm:h-12",
                )}
                crossOrigin="anonymous"
                onError={() => setShirtFailed(true)}
              />
            ) : (
              <div
                aria-hidden
                className={cn(
                  "flex items-center justify-center rounded-sm bg-black/40 text-[10px] font-bold text-white/50",
                  compact ? "h-8 w-6" : "h-11 w-8 sm:h-12 sm:w-9",
                )}
              >
                {player.position?.slice(0, 1) ?? "?"}
              </div>
            )}

            <p
              className={cn(
                "mt-0.5 truncate text-center font-bold leading-tight text-white",
                compact
                  ? "max-w-full text-[10px] sm:text-[11px]"
                  : "line-clamp-2 min-h-[1.7rem] text-[11px] sm:min-h-[1.9rem] sm:text-[12px]",
              )}
            >
              {name ?? `#${player.fpl_id}`}
            </p>
            {!compact ? (
              <p className="truncate text-center text-[8px] font-medium uppercase tracking-wide text-white/60 sm:text-[9px]">
                {player.team ?? "—"}
              </p>
            ) : null}

            <div
              className={cn(
                "mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-black/45",
                compact ? "px-1 py-0.5" : "px-1.5 py-1",
              )}
            >
              {!compact ? (
                <span className="text-[7px] uppercase tracking-wide text-white/45 sm:text-[8px]">
                  {t("cardGwPts")}
                </span>
              ) : null}
              <span
                className={cn(
                  "font-black tabular-nums text-[#7dffa8]",
                  compact ? "text-[12px]" : "text-[13px] sm:text-[14px]",
                )}
              >
                {player.total_points != null ? player.total_points : "—"}
              </span>
            </div>
          </div>
        ) : (
          <div className="relative px-1 pb-1 pt-1 sm:px-2 sm:pb-2 sm:pt-2">
            <div className="mb-0.5 flex items-center justify-between gap-1 sm:mb-1">
              <span className="rounded bg-white/10 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/85 sm:text-[9px]">
                {player.position ?? "—"}
              </span>
              <div className="flex items-center gap-0.5">
                {isC ? (
                  <span className="rounded-full bg-[#7dffa8] px-1.5 py-0.5 text-[8px] font-black text-[#062016] sm:text-[9px]">
                    C
                  </span>
                ) : null}
                {isV && !isC ? (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[8px] font-bold text-white sm:text-[9px]">
                    V
                  </span>
                ) : null}
              </div>
            </div>

            <p className="line-clamp-2 min-h-[1.6rem] text-center text-[11px] font-bold leading-tight text-white sm:min-h-[2.1rem] sm:text-[13px]">
              {name ?? `#${player.fpl_id}`}
            </p>
            <p
              className={cn(
                "truncate text-center text-[8px] font-medium tracking-wide sm:text-[10px]",
                fixtureLabel
                  ? "text-[#7dffa8]/90"
                  : "uppercase text-white/55",
              )}
              title={
                fixtureLabel
                  ? `${player.team ?? ""} · ${fixtureLabel}`.replace(/^ · /, "")
                  : (player.team ?? undefined)
              }
            >
              {fixtureLabel ?? player.team ?? "—"}
            </p>

            {status ? (
              <p className="mt-0.5 text-center text-[8px] font-semibold text-amber-300 sm:text-[9px]">
                {status}
              </p>
            ) : null}

            <div className="mt-1 grid grid-cols-3 gap-0.5 rounded-md bg-black/35 px-1 py-0.5 text-center sm:mt-1.5 sm:py-1">
              <div>
                <p className="text-[7px] uppercase tracking-wide text-white/45 sm:text-[8px]">
                  {t("cardSeasonPts")}
                </p>
                <p className="text-[9px] font-semibold tabular-nums text-white/90 sm:text-[10px]">
                  {player.total_points != null ? player.total_points : "—"}
                </p>
              </div>
              <div>
                <p className="text-[7px] uppercase tracking-wide text-white/45 sm:text-[8px]">
                  {t("cardForm")}
                </p>
                <p className="text-[9px] font-semibold tabular-nums text-white/90 sm:text-[10px]">
                  {fmtNum(player.form)}
                </p>
              </div>
              <div>
                <p className="text-[7px] uppercase tracking-wide text-white/45 sm:text-[8px]">
                  {t("cardMiniOwn")}
                </p>
                <p className="text-[9px] font-semibold tabular-nums text-white/90 sm:text-[10px]">
                  {miniOwnedPct != null ? `${Math.round(miniOwnedPct)}%` : "—"}
                </p>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="flex min-h-[5.25rem] flex-col items-center justify-center px-2 py-3 sm:min-h-[5.75rem]">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/10 text-lg font-light text-white/80">
            +
          </span>
          <span className="mt-1.5 text-center text-[9px] font-medium text-white/70 sm:text-[10px]">
            {emptyLabel}
          </span>
          <span className="mt-0.5 text-[8px] uppercase tracking-[0.14em] text-white/40">
            {slotLabel}
          </span>
        </div>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-1",
        compact
          ? "max-w-[5.25rem] sm:max-w-[5.75rem]"
          : "max-w-[5.75rem] sm:max-w-[7.25rem]",
      )}
    >
      {interactive ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSlotClick(slotIndex)}
          className={cardCls}
        >
          {cardBody}
        </button>
      ) : (
        <div className={cardCls}>{cardBody}</div>
      )}

      {filled && !readOnly ? (
        <div className="flex w-full gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSetCaptain(player.fpl_id)}
            className={cn(
              "flex-1 rounded-md py-0.5 text-[9px] font-bold tracking-wide sm:text-[10px]",
              isC
                ? "bg-[#7dffa8] text-[#062016] shadow-[0_0_12px_rgba(125,255,168,0.35)]"
                : "bg-black/35 text-white/75 ring-1 ring-white/15 hover:bg-black/50 hover:text-white",
            )}
          >
            {captainLabel}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSetVice(player.fpl_id)}
            className={cn(
              "flex-1 rounded-md py-0.5 text-[9px] font-bold tracking-wide sm:text-[10px]",
              isV
                ? "bg-white/90 text-[#0b1f17]"
                : "bg-black/35 text-white/75 ring-1 ring-white/15 hover:bg-black/50 hover:text-white",
            )}
          >
            {viceLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function MiniPitch({
  slots,
  captainId,
  viceId,
  activeSlot,
  disabled,
  readOnly,
  showGwPoints,
  compact,
  fixtureByFplId,
  slotGkLabel,
  slotOutLabel,
  captainLabel,
  viceLabel,
  emptyLabel,
  miniOwnedById,
  onSlotClick,
  onSetCaptain,
  onSetVice,
}: {
  slots: (MiniPitchPlayer | null)[];
  captainId: number | null;
  viceId: number | null;
  activeSlot: number | null;
  disabled?: boolean;
  readOnly?: boolean;
  showGwPoints?: boolean;
  /** Content-height pitch (no fixed aspect clip) for inspect modals. */
  compact?: boolean;
  /** Next fixture label by FPL id, e.g. `MCI (H)`. */
  fixtureByFplId?: Record<number, string | null | undefined>;
  slotGkLabel: string;
  slotOutLabel: string;
  captainLabel: string;
  viceLabel: string;
  emptyLabel: string;
  /** Mini 5 selection % by FPL player id for the open/scoring GW. */
  miniOwnedById?: Record<number, number>;
  onSlotClick: (slotIndex: number) => void;
  onSetCaptain: (fplId: number) => void;
  onSetVice: (fplId: number) => void;
}) {
  const gk = slots[MINI_GK_SLOT] ?? null;
  const out1 = slots[1] ?? null;
  const out2 = slots[2] ?? null;
  const out3 = slots[3] ?? null;
  const out4 = slots[4] ?? null;

  const cardProps = {
    captainId,
    viceId,
    disabled,
    readOnly,
    showGwPoints,
    compact,
    onSlotClick,
    onSetCaptain,
    onSetVice,
    captainLabel,
    viceLabel,
    emptyLabel,
  };

  function ownedPct(player: MiniPitchPlayer | null): number | null {
    if (!player) return null;
    if (!miniOwnedById) return null;
    const v = miniOwnedById[player.fpl_id];
    return v != null && Number.isFinite(v) ? v : 0;
  }

  function fixtureFor(player: MiniPitchPlayer | null): string | null {
    if (!player || !fixtureByFplId) return null;
    return fixtureByFplId[player.fpl_id] ?? null;
  }

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-2xl overflow-hidden rounded-[1.25rem] border border-[#1f6b45]/70 shadow-[0_18px_40px_rgba(0,0,0,0.32)]",
        // Content-height pitch so GKP + C/V buttons are never clipped on mobile.
        "min-h-0",
      )}
    >
      {/* Grass */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #1c8250 0%, #157043 55%, #0f5230 100%)",
        }}
      />
      {/* Stripes toward goal */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 22px, rgba(0,0,0,0.07) 22px 44px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(125,255,168,0.1), transparent 40%), radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.25), transparent 45%)",
        }}
      />

      <HalfPitchMarkings />

      <div
        className={cn(
          "relative z-[1] flex flex-col",
          compact
            ? "gap-2 px-2 py-2.5 sm:gap-2.5 sm:px-3 sm:py-3"
            : "gap-2 px-2 py-2.5 sm:gap-3 sm:px-4 sm:py-4",
        )}
      >
        {/* Outfield near halfway */}
        <div
          className={cn(
            "grid grid-cols-2 justify-items-center",
            compact ? "gap-1.5" : "gap-2 sm:gap-6",
          )}
        >
          <PitchCard
            slotIndex={1}
            player={out1}
            slotLabel={slotOutLabel}
            active={activeSlot === 1}
            miniOwnedPct={ownedPct(out1)}
            fixtureLabel={fixtureFor(out1)}
            {...cardProps}
          />
          <PitchCard
            slotIndex={2}
            player={out2}
            slotLabel={slotOutLabel}
            active={activeSlot === 2}
            miniOwnedPct={ownedPct(out2)}
            fixtureLabel={fixtureFor(out2)}
            {...cardProps}
          />
        </div>

        <div
          className={cn(
            "grid grid-cols-2 justify-items-center",
            compact ? "gap-1.5" : "gap-2 sm:gap-6",
          )}
        >
          <PitchCard
            slotIndex={3}
            player={out3}
            slotLabel={slotOutLabel}
            active={activeSlot === 3}
            miniOwnedPct={ownedPct(out3)}
            fixtureLabel={fixtureFor(out3)}
            {...cardProps}
          />
          <PitchCard
            slotIndex={4}
            player={out4}
            slotLabel={slotOutLabel}
            active={activeSlot === 4}
            miniOwnedPct={ownedPct(out4)}
            fixtureLabel={fixtureFor(out4)}
            {...cardProps}
          />
        </div>

        {/* GK in the box — reserved bottom space so C/V controls stay visible */}
        <div
          className={cn(
            "flex justify-center",
            compact ? "pt-0.5 pb-0.5" : "pt-1 pb-1 sm:pb-2",
          )}
        >
          <PitchCard
            slotIndex={MINI_GK_SLOT}
            player={gk}
            slotLabel={slotGkLabel}
            active={activeSlot === MINI_GK_SLOT}
            miniOwnedPct={ownedPct(gk)}
            fixtureLabel={fixtureFor(gk)}
            {...cardProps}
          />
        </div>
      </div>
    </div>
  );
}
