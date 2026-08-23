"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MiniPitch } from "@/components/mini/mini-pitch";
import type { MiniPickStored } from "@/lib/mini/types";
import type { MiniPlayerDisplay } from "@/lib/mini/player-stats";
import { MINI_GK_SLOT, MINI_SLOT_COUNT } from "@/components/mini/mini-pitch";
import { getFplShirtUrl } from "@/lib/team-themes";

type ScoreLine = {
  player_id: number;
  base_points: number;
  captain_bonus: number;
  scored_points: number;
};

const POS_ORDER: Record<string, number> = {
  GKP: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
};

function picksToInspectSlots(
  picks: MiniPickStored[],
  gwPointsByFplId: Record<number, number>,
): (MiniPlayerDisplay | null)[] {
  const slots: (MiniPlayerDisplay | null)[] = Array.from(
    { length: MINI_SLOT_COUNT },
    () => null,
  );
  const asDisplay = (p: MiniPickStored): MiniPlayerDisplay => ({
    fpl_id: p.fpl_id,
    web_name: p.web_name,
    team: p.team,
    team_id: p.team_id,
    position: p.position,
    base_price: p.base_price ?? null,
    status: p.status ?? null,
    form: p.form ?? null,
    total_points: gwPointsByFplId[p.fpl_id] ?? 0,
    points_per_game: p.points_per_game ?? null,
    selected_by_percent: p.selected_by_percent ?? null,
    goals_scored: p.goals_scored ?? null,
    assists: p.assists ?? null,
    expected_goals: p.expected_goals ?? null,
    expected_assists: p.expected_assists ?? null,
  });
  const gk = picks.find((p) => p.position === "GKP");
  const rest = picks.filter((p) => p.position !== "GKP");
  if (gk) slots[MINI_GK_SLOT] = asDisplay(gk);
  rest.forEach((p, i) => {
    if (i + 1 < MINI_SLOT_COUNT) slots[i + 1] = asDisplay(p);
  });
  return slots;
}

function BreakdownRow({
  pick,
  line,
  isCaptain,
  isVice,
  baseLabel,
  capBonusLabel,
}: {
  pick: MiniPickStored;
  line: ScoreLine | null;
  isCaptain: boolean;
  isVice: boolean;
  baseLabel: string;
  capBonusLabel: string;
}) {
  const shirtUrl = getFplShirtUrl(pick.team, pick.position);
  const scored = line?.scored_points ?? 0;
  const base = line?.base_points ?? 0;
  const bonus = line?.captain_bonus ?? 0;

  return (
    <li className="flex items-center gap-3 border-b border-border/60 px-1 py-2.5 last:border-b-0">
      <div className="flex h-10 w-8 shrink-0 items-center justify-center">
        {shirtUrl ? (
          <img
            src={shirtUrl}
            alt=""
            width={40}
            height={53}
            loading="lazy"
            decoding="async"
            className="h-10 w-auto drop-shadow-sm"
          />
        ) : (
          <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
            {pick.position ?? "—"}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">
            {pick.web_name ?? `#${pick.fpl_id}`}
          </p>
          {isCaptain ? (
            <span className="rounded-full bg-brand-accent/20 px-1.5 py-0.5 text-[9px] font-black text-brand-accent">
              C
            </span>
          ) : null}
          {isVice && !isCaptain ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
              V
            </span>
          ) : null}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {pick.position ?? "—"}
          {pick.team ? ` · ${pick.team}` : ""}
          {bonus > 0 ? (
            <span className="ml-1.5 text-foreground/70">
              {baseLabel} {base}
              <span className="text-brand-accent"> +{capBonusLabel}</span>
            </span>
          ) : null}
        </p>
      </div>

      <p
        className={cn(
          "shrink-0 text-base font-bold tabular-nums",
          scored > 0 ? "text-brand-accent" : "text-muted-foreground",
        )}
      >
        {scored}
      </p>
    </li>
  );
}

export function MiniSquadInspectModal({
  open,
  row,
  gw,
  onClose,
}: {
  open: boolean;
  row: {
    entry_name: string | null;
    entry_id: number;
    rank?: number;
    total_points: number;
    yesterday_points: number | null;
    captain_fpl_id: number;
    vice_fpl_id: number;
    differential_captain?: boolean;
    differential_bonus?: number;
    picks: MiniPickStored[];
    gw_points_by_fpl_id?: Record<number, number>;
    breakdown?: ScoreLine[];
  } | null;
  gw: number | null;
  onClose: () => void;
}) {
  const t = useTranslations("mini");

  if (!open || !row) return null;

  const gwPoints = row.gw_points_by_fpl_id ?? {};
  const slots = picksToInspectSlots(row.picks, gwPoints);
  const name = row.entry_name ?? `#${row.entry_id}`;
  const byId = new Map((row.breakdown ?? []).map((b) => [b.player_id, b]));

  const orderedPicks = [...row.picks].sort((a, b) => {
    const pa = POS_ORDER[a.position ?? ""] ?? 9;
    const pb = POS_ORDER[b.position ?? ""] ?? 9;
    if (pa !== pb) return pa - pb;
    const sa = byId.get(a.fpl_id)?.scored_points ?? gwPoints[a.fpl_id] ?? 0;
    const sb = byId.get(b.fpl_id)?.scored_points ?? gwPoints[b.fpl_id] ?? 0;
    return sb - sa;
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mini-squad-inspect-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label={t("inspectClose")}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-[101] flex max-h-[94vh] w-full max-w-xl flex-col",
          "rounded-xl border border-border bg-background shadow-2xl sm:rounded-2xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-border px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {row.rank != null ? (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                    #{row.rank}
                  </span>
                ) : null}
                <h2
                  id="mini-squad-inspect-title"
                  className="truncate text-base font-semibold text-foreground sm:text-lg"
                >
                  {t("inspectSquadTitle", { name, gw: gw ?? "—" })}
                </h2>
              </div>
              <div className="mt-1.5 flex flex-wrap items-end gap-x-4 gap-y-1">
                <p className="text-2xl font-black tabular-nums tracking-tight text-brand-accent sm:text-3xl">
                  {row.total_points}
                  <span className="ml-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
                    {t("inspectPtsUnit")}
                  </span>
                </p>
                {row.yesterday_points != null ? (
                  <p className="pb-0.5 text-sm text-muted-foreground">
                    {t("inspectYesterdayPts", { pts: row.yesterday_points })}
                  </p>
                ) : null}
                {row.differential_captain && (row.differential_bonus ?? 0) > 0 ? (
                  <p className="pb-0.5 text-xs font-medium text-brand-accent/90">
                    {t("inspectDiffBonus", { n: row.differential_bonus })}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t("inspectClose")}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-3 p-3 sm:space-y-4 sm:p-5">
            <MiniPitch
              slots={slots}
              captainId={row.captain_fpl_id}
              viceId={row.vice_fpl_id}
              activeSlot={null}
              readOnly
              showGwPoints
              compact
              slotGkLabel={t("slotGk")}
              slotOutLabel={t("slotOut")}
              captainLabel={t("captain")}
              viceLabel={t("vice")}
              emptyLabel={t("emptySlot")}
              onSlotClick={() => undefined}
              onSetCaptain={() => undefined}
              onSetVice={() => undefined}
            />

            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("inspectBreakdown")}
              </h3>
              <ul className="rounded-xl border border-border bg-card/40 px-3">
                {orderedPicks.map((pick) => {
                  const line = byId.get(pick.fpl_id) ?? null;
                  const fallback: ScoreLine | null =
                    line ??
                    (gwPoints[pick.fpl_id] != null
                      ? {
                          player_id: pick.fpl_id,
                          base_points: gwPoints[pick.fpl_id],
                          captain_bonus: 0,
                          scored_points: gwPoints[pick.fpl_id],
                        }
                      : null);
                  return (
                    <BreakdownRow
                      key={pick.fpl_id}
                      pick={pick}
                      line={fallback}
                      isCaptain={pick.fpl_id === row.captain_fpl_id}
                      isVice={pick.fpl_id === row.vice_fpl_id}
                      baseLabel={t("inspectBasePts")}
                      capBonusLabel={t("inspectCapBonus")}
                    />
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
