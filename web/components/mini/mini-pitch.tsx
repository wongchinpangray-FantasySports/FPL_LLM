"use client";

import { cn } from "@/lib/utils";

export const MINI_SLOT_COUNT = 5;
/** Slot 0 = GK (bottom); slots 1–4 = outfield. */
export const MINI_GK_SLOT = 0;

export type MiniPitchPlayer = {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  position: string | null;
  base_price: number | null;
};

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
}) {
  const filled = player != null;
  const isC = filled && captainId === player.fpl_id;
  const isV = filled && viceId === player.fpl_id;
  const name = player?.web_name ?? player?.name ?? null;

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSlotClick(slotIndex)}
        className={cn(
          "relative flex min-h-[52px] min-w-[56px] max-w-[88px] flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center shadow-sm transition-all sm:min-h-[64px] sm:min-w-[72px] sm:max-w-[100px] sm:rounded-xl sm:px-2 sm:py-2",
          "border-white/20 bg-black/45 backdrop-blur-sm",
          !disabled && "hover:border-brand-accent/60 hover:bg-black/55 cursor-pointer",
          active && "ring-2 ring-brand-accent ring-offset-1 ring-offset-emerald-950",
          filled && "border-brand-accent/30",
          !filled && "border-dashed border-white/25 bg-black/25",
        )}
      >
        {filled ? (
          <>
            <span className="line-clamp-2 text-[9px] font-semibold leading-tight text-white sm:text-[11px]">
              {name ?? `#${player.fpl_id}`}
            </span>
            <span className="mt-0.5 truncate text-[7px] text-slate-400 sm:text-[8px]">
              {player.team ?? "—"}
            </span>
            <span className="text-[7px] tabular-nums text-slate-500 sm:text-[8px]">
              £{player.base_price != null ? player.base_price.toFixed(1) : "?"}m
            </span>
            <div className="mt-0.5 flex items-center justify-center gap-0.5">
              {isC && (
                <span className="rounded bg-brand-accent/25 px-1 text-[7px] font-bold text-brand-accent sm:text-[8px]">
                  C
                </span>
              )}
              {isV && !isC && (
                <span className="rounded bg-white/15 px-1 text-[7px] text-slate-300 sm:text-[8px]">
                  V
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="text-lg text-slate-500 sm:text-xl">+</span>
            <span className="text-[8px] text-slate-500 sm:text-[9px]">{emptyLabel}</span>
          </>
        )}
      </button>
      <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500">
        {slotLabel}
      </span>
      {filled ? (
        <div className="flex gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSetCaptain(player.fpl_id)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-semibold sm:text-[10px]",
              isC
                ? "bg-brand-accent text-brand-ink"
                : "bg-white/10 text-slate-300 hover:bg-white/15",
            )}
          >
            {captainLabel}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSetVice(player.fpl_id)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-semibold sm:text-[10px]",
              isV
                ? "bg-white/20 text-white"
                : "bg-white/10 text-slate-300 hover:bg-white/15",
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
    <div className="overflow-hidden rounded-xl border border-emerald-700/50 bg-gradient-to-b from-emerald-950 via-emerald-900/95 to-emerald-950 shadow-lg sm:rounded-2xl">
      <div className="relative flex aspect-[5/3.2] flex-col justify-between px-2 py-3 sm:aspect-[5/3.5] sm:px-4 sm:py-4">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 -translate-y-1/2 bg-white/10" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />

        <div className="flex flex-1 flex-col justify-between gap-2">
          <div className="flex justify-center gap-2 sm:gap-4">
            <PitchCard
              slotIndex={1}
              player={out1}
              slotLabel={slotOutLabel}
              active={activeSlot === 1}
              {...cardProps}
            />
            <PitchCard
              slotIndex={2}
              player={out2}
              slotLabel={slotOutLabel}
              active={activeSlot === 2}
              {...cardProps}
            />
          </div>
          <div className="flex justify-center gap-2 sm:gap-4">
            <PitchCard
              slotIndex={3}
              player={out3}
              slotLabel={slotOutLabel}
              active={activeSlot === 3}
              {...cardProps}
            />
            <PitchCard
              slotIndex={4}
              player={out4}
              slotLabel={slotOutLabel}
              active={activeSlot === 4}
              {...cardProps}
            />
          </div>
          <div className="flex justify-center">
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
