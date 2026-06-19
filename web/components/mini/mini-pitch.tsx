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
  const t = useTranslations("mini");
  const filled = player != null;
  const isC = filled && captainId === player.fpl_id;
  const isV = filled && viceId === player.fpl_id;
  const name = player?.web_name ?? null;
  const status = filled ? statusLabel(player.status, t) : null;
  const ga =
    filled &&
    (player.goals_scored != null || player.assists != null) &&
    (player.goals_scored !== 0 || player.assists !== 0)
      ? `${player.goals_scored ?? 0}G ${player.assists ?? 0}A`
      : null;

  return (
    <div className="flex w-full max-w-[11rem] flex-col items-center gap-2 sm:max-w-[13rem]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSlotClick(slotIndex)}
        className={cn(
          "relative flex w-full flex-col rounded-xl border text-left shadow-md transition-all",
          filled
            ? "min-h-[7.5rem] border-brand-accent/35 bg-black/55 px-2.5 py-2.5 sm:min-h-[8.5rem] sm:px-3 sm:py-3"
            : "min-h-[7rem] items-center justify-center border-dashed border-border/80 bg-input px-3 py-4 sm:min-h-[8rem]",
          !disabled &&
            "cursor-pointer hover:border-brand-accent/55 hover:bg-black/65",
          active &&
            "ring-2 ring-brand-accent ring-offset-2 ring-offset-emerald-950",
        )}
      >
        {filled ? (
          <>
            <div className="mb-1.5 flex items-start justify-between gap-1">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/90 sm:text-[11px]">
                {player.position ?? "—"}
              </span>
              <div className="flex shrink-0 gap-0.5">
                {isC && (
                  <span className="rounded bg-brand-accent px-1.5 py-0.5 text-[10px] font-bold text-brand-ink sm:text-[11px]">
                    C
                  </span>
                )}
                {isV && !isC && (
                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-foreground sm:text-[11px]">
                    V
                  </span>
                )}
              </div>
            </div>

            <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
              {name ?? `#${player.fpl_id}`}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{player.team ?? "—"}</p>

            {status ? (
              <p className="mt-1 text-[10px] font-medium text-amber-400/90 sm:text-[11px]">
                {status}
              </p>
            ) : null}

            <div className="mt-2 grid w-full grid-cols-2 gap-x-2 gap-y-1 border-t border-border pt-2 text-[10px] sm:text-[11px]">
              <div>
                <span className="text-muted-foreground">{t("cardPrice")}</span>
                <p className="font-medium tabular-nums text-foreground/90">
                  £{fmtNum(player.base_price)}m
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("cardForm")}</span>
                <p className="font-medium tabular-nums text-foreground/90">
                  {fmtNum(player.form)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("cardPpg")}</span>
                <p className="font-medium tabular-nums text-foreground/90">
                  {fmtNum(player.points_per_game)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("cardOwn")}</span>
                <p className="font-medium tabular-nums text-foreground/90">
                  {player.selected_by_percent != null
                    ? `${fmtNum(player.selected_by_percent)}%`
                    : "—"}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">{t("cardSeasonPts")}</span>
                <p className="font-semibold tabular-nums text-brand-accent/95">
                  {player.total_points != null ? player.total_points : "—"}{" "}
                  <span className="font-normal text-muted-foreground">{t("cardPtsUnit")}</span>
                </p>
              </div>
              {(player.expected_goals != null ||
                player.expected_assists != null) && (
                <div className="col-span-2 flex gap-3 text-[10px] sm:text-[11px]">
                  <span className="text-muted-foreground">
                    {t("cardXg")}{" "}
                    <span className="font-medium text-foreground/70">
                      {fmtNum(player.expected_goals, 2)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {t("cardXa")}{" "}
                    <span className="font-medium text-foreground/70">
                      {fmtNum(player.expected_assists, 2)}
                    </span>
                  </span>
                </div>
              )}
              {ga ? (
                <div className="col-span-2 text-[10px] text-muted-foreground sm:text-[11px]">
                  {t("cardGoalsAssists")}: {ga}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <span className="text-3xl font-light text-muted-foreground sm:text-4xl">+</span>
            <span className="mt-2 text-center text-xs text-muted-foreground sm:text-sm">
              {emptyLabel}
            </span>
          </>
        )}
      </button>

      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
        {slotLabel}
      </span>

      {filled ? (
        <div className="flex w-full gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSetCaptain(player.fpl_id)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold sm:text-sm",
              isC
                ? "bg-brand-accent text-brand-ink shadow-[0_0_12px_rgba(0,255,135,0.35)]"
                : "bg-muted text-foreground/70 hover:bg-white/15",
            )}
          >
            {captainLabel}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSetVice(player.fpl_id)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold sm:text-sm",
              isV
                ? "bg-white/25 text-foreground"
                : "bg-muted text-foreground/70 hover:bg-white/15",
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
    <div className="overflow-hidden rounded-2xl border border-emerald-700/50 bg-gradient-to-b from-emerald-950 via-emerald-900/95 to-emerald-950 shadow-lg">
      <div className="relative px-3 py-5 sm:px-6 sm:py-8">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[78%] -translate-x-1/2 -translate-y-1/2 bg-muted" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border" />

        <div className="relative flex flex-col items-center gap-5 sm:gap-7">
          <div className="grid w-full max-w-lg grid-cols-2 justify-items-center gap-4 sm:max-w-2xl sm:gap-6">
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
          <div className="grid w-full max-w-lg grid-cols-2 justify-items-center gap-4 sm:max-w-2xl sm:gap-6">
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
