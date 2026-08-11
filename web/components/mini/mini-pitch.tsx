"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MiniPlayerDisplay } from "@/lib/mini/player-stats";

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

function PitchMarkings() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 160"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Outer touchline */}
      <rect
        x="4"
        y="4"
        width="92"
        height="152"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.7"
      />
      {/* Halfway line */}
      <line
        x1="4"
        y1="80"
        x2="96"
        y2="80"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.55"
      />
      {/* Centre circle */}
      <circle
        cx="50"
        cy="80"
        r="14"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.55"
      />
      <circle cx="50" cy="80" r="1.1" fill="rgba(255,255,255,0.35)" />
      {/* Top penalty area (attack) */}
      <rect
        x="22"
        y="4"
        width="56"
        height="22"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.55"
      />
      <rect
        x="34"
        y="4"
        width="32"
        height="9"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.45"
      />
      {/* Bottom penalty area (GK) */}
      <rect
        x="22"
        y="134"
        width="56"
        height="22"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.55"
      />
      <rect
        x="34"
        y="147"
        width="32"
        height="9"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.45"
      />
      {/* Corner arcs (simplified ticks) */}
      <path
        d="M4 8 Q8 4 8 4"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.45"
      />
      <path
        d="M96 8 Q92 4 92 4"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.45"
      />
      <path
        d="M4 152 Q8 156 8 156"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.45"
      />
      <path
        d="M96 152 Q92 156 92 156"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
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
  onSlotClick,
  onSetCaptain,
  onSetVice,
  captainLabel,
  viceLabel,
  emptyLabel,
  compact,
}: {
  slotIndex: number;
  player: MiniPitchPlayer | null;
  slotLabel: string;
  captainId: number | null;
  viceId: number | null;
  active: boolean;
  disabled?: boolean;
  onSlotClick: (slotIndex: number) => void;
  onSetCaptain: (fplId: number) => void;
  onSetVice: (fplId: number) => void;
  captainLabel: string;
  viceLabel: string;
  emptyLabel: string;
  compact?: boolean;
}) {
  const t = useTranslations("mini");
  const filled = player != null;
  const isC = filled && captainId === player.fpl_id;
  const isV = filled && viceId === player.fpl_id;
  const name = player?.web_name ?? null;
  const status = filled ? statusLabel(player.status, t) : null;

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-1.5",
        compact ? "max-w-[6.75rem] sm:max-w-[7.75rem]" : "max-w-[7.25rem] sm:max-w-[8.25rem]",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSlotClick(slotIndex)}
        className={cn(
          "group relative w-full overflow-hidden rounded-2xl text-left transition-all duration-200",
          "shadow-[0_10px_24px_rgba(0,0,0,0.35)]",
          filled
            ? "bg-gradient-to-b from-[#1a2430] via-[#121820] to-[#0b1016] ring-1 ring-white/15"
            : "border border-dashed border-white/35 bg-black/25 backdrop-blur-[2px]",
          !disabled && "cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5 hover:ring-white/35",
          !disabled && filled && "hover:shadow-[0_14px_28px_rgba(0,0,0,0.45)]",
          active && "ring-2 ring-[#7dffa8] ring-offset-2 ring-offset-[#0d3b24]",
        )}
      >
        {/* jersey sheen */}
        {filled ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background:
                "linear-gradient(135deg, rgba(125,255,168,0.12) 0%, transparent 42%, rgba(255,255,255,0.04) 100%)",
            }}
          />
        ) : null}

        {filled ? (
          <div className="relative px-2 pb-2 pt-2 sm:px-2.5 sm:pb-2.5 sm:pt-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/85 sm:text-[10px]">
                {player.position ?? "—"}
              </span>
              <div className="flex items-center gap-0.5">
                {isC ? (
                  <span className="rounded-full bg-[#7dffa8] px-1.5 py-0.5 text-[9px] font-black text-[#062016] sm:text-[10px]">
                    C
                  </span>
                ) : null}
                {isV && !isC ? (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold text-white sm:text-[10px]">
                    V
                  </span>
                ) : null}
              </div>
            </div>

            <p className="line-clamp-2 min-h-[2.25rem] text-center text-[13px] font-bold leading-tight text-white sm:min-h-[2.4rem] sm:text-sm">
              {name ?? `#${player.fpl_id}`}
            </p>
            <p className="mt-0.5 truncate text-center text-[10px] font-medium uppercase tracking-wide text-white/55 sm:text-[11px]">
              {player.team ?? "—"}
            </p>

            {status ? (
              <p className="mt-1 text-center text-[9px] font-semibold text-amber-300 sm:text-[10px]">
                {status}
              </p>
            ) : null}

            <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-black/35 px-1.5 py-1.5 text-center">
              <div>
                <p className="text-[8px] uppercase tracking-wide text-white/45 sm:text-[9px]">
                  {t("cardPrice")}
                </p>
                <p className="text-[10px] font-semibold tabular-nums text-white/90 sm:text-[11px]">
                  {fmtNum(player.base_price)}
                </p>
              </div>
              <div>
                <p className="text-[8px] uppercase tracking-wide text-white/45 sm:text-[9px]">
                  {t("cardForm")}
                </p>
                <p className="text-[10px] font-semibold tabular-nums text-white/90 sm:text-[11px]">
                  {fmtNum(player.form)}
                </p>
              </div>
              <div>
                <p className="text-[8px] uppercase tracking-wide text-white/45 sm:text-[9px]">
                  {t("cardOwn")}
                </p>
                <p className="text-[10px] font-semibold tabular-nums text-white/90 sm:text-[11px]">
                  {player.selected_by_percent != null
                    ? `${Math.round(player.selected_by_percent)}%`
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[6.5rem] flex-col items-center justify-center px-2 py-4 sm:min-h-[7.25rem]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-xl font-light text-white/80 sm:h-10 sm:w-10 sm:text-2xl">
              +
            </span>
            <span className="mt-2 text-center text-[10px] font-medium text-white/70 sm:text-[11px]">
              {emptyLabel}
            </span>
            <span className="mt-1 text-[9px] uppercase tracking-[0.16em] text-white/40">
              {slotLabel}
            </span>
          </div>
        )}
      </button>

      {filled ? (
        <div className="flex w-full gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSetCaptain(player.fpl_id)}
            className={cn(
              "flex-1 rounded-lg py-1 text-[10px] font-bold tracking-wide sm:text-[11px]",
              isC
                ? "bg-[#7dffa8] text-[#062016] shadow-[0_0_14px_rgba(125,255,168,0.35)]"
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
              "flex-1 rounded-lg py-1 text-[10px] font-bold tracking-wide sm:text-[11px]",
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
  slotGkLabel,
  slotOutLabel,
  captainLabel,
  viceLabel,
  emptyLabel,
  onSlotClick,
  onSetCaptain,
  onSetVice,
}: {
  slots: (MiniPitchPlayer | null)[];
  captainId: number | null;
  viceId: number | null;
  activeSlot: number | null;
  disabled?: boolean;
  slotGkLabel: string;
  slotOutLabel: string;
  captainLabel: string;
  viceLabel: string;
  emptyLabel: string;
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
    onSlotClick,
    onSetCaptain,
    onSetVice,
    captainLabel,
    viceLabel,
    emptyLabel,
  };

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-[#1f6b45]/70 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
      {/* Grass base + stripes */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #1a7a48 0%, #14653b 45%, #0f5230 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 28px, rgba(0,0,0,0.08) 28px 56px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 18%, rgba(125,255,168,0.12), transparent 42%), radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.28), transparent 50%)",
        }}
      />

      <div className="relative min-h-[34rem] px-2 py-4 sm:min-h-[38rem] sm:px-5 sm:py-6">
        <PitchMarkings />

        <div className="relative z-[1] flex h-full min-h-[32rem] flex-col justify-between gap-4 py-2 sm:min-h-[36rem] sm:gap-5 sm:py-3">
          {/* Attack / outfield line 1 */}
          <div className="grid grid-cols-2 justify-items-center gap-3 px-1 sm:gap-8">
            <PitchCard
              slotIndex={1}
              player={out1}
              slotLabel={slotOutLabel}
              active={activeSlot === 1}
              compact
              {...cardProps}
            />
            <PitchCard
              slotIndex={2}
              player={out2}
              slotLabel={slotOutLabel}
              active={activeSlot === 2}
              compact
              {...cardProps}
            />
          </div>

          {/* Midfield / outfield line 2 */}
          <div className="grid grid-cols-2 justify-items-center gap-3 px-1 sm:gap-8">
            <PitchCard
              slotIndex={3}
              player={out3}
              slotLabel={slotOutLabel}
              active={activeSlot === 3}
              compact
              {...cardProps}
            />
            <PitchCard
              slotIndex={4}
              player={out4}
              slotLabel={slotOutLabel}
              active={activeSlot === 4}
              compact
              {...cardProps}
            />
          </div>

          {/* GK */}
          <div className="flex justify-center pb-1">
            <PitchCard
              slotIndex={MINI_GK_SLOT}
              player={gk}
              slotLabel={slotGkLabel}
              active={activeSlot === MINI_GK_SLOT}
              {...cardProps}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
