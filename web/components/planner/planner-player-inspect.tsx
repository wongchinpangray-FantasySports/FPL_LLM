"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { xpCellClass } from "@/components/xp-heatmap";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PlannerPlayerInspectDetail {
  currentGw: number;
  fromGw: number;
  toGw: number;
  horizon: number;
  profile: {
    fpl_id: number;
    web_name: string | null;
    team: string | null;
    position: string | null;
    price: number | null;
    form: number | null;
    ownership: number | null;
    total_points: number | null;
    minutes_season: number | null;
    goals_scored: number | null;
    assists: number | null;
    ict_index: number | null;
    news: string | null;
    transfers_in_event: number | null;
    transfers_out_event: number | null;
  };
  availability: { p: number; note: string | null };
  setPieces: {
    penalties: number | null;
    freekicks: number | null;
    corners: number | null;
    score: number;
  };
  rolling: {
    window_gws: number;
    minutes: number;
    starts: number;
    apps: number;
    goals: number;
    assists: number;
    points: number;
    xg: number;
    xa: number;
    saves: number;
    cs: number;
    dc_points: number;
  };
  fixtures: Array<{
    gw: number;
    opp_short: string;
    home: boolean;
    fdr: number | null;
    xp_total: number;
    expected_minutes: number;
    xG: number;
    xA: number;
    p_clean_sheet: number;
    opp_history_mult: number;
  }>;
  xp_total: number;
  xp_per_game: number;
  value_per_million: number | null;
}

export function PlannerPlayerInspectSheet({
  open,
  loading,
  error,
  detail,
  showTransfer,
  onClose,
  onTransfer,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: PlannerPlayerInspectDetail | null;
  /** Planning scenario only — opens transfer picker */
  showTransfer: boolean;
  onClose: () => void;
  onTransfer: () => void;
}) {
  const t = useTranslations("plannerApp");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const name = detail?.profile.web_name ?? `#${detail?.profile.fpl_id ?? ""}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="planner-inspect-title"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.1] bg-brand-ink p-5 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="planner-inspect-title"
              className="text-lg font-semibold text-white"
            >
              {loading ? t("inspectLoadingTitle") : name}
            </h2>
            {detail ? (
              <p className="mt-1 text-sm text-slate-400">
                {detail.profile.team ?? "—"} · {detail.profile.position ?? "—"}{" "}
                · £{detail.profile.price != null ? detail.profile.price.toFixed(1) : "?"}m
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            {t("inspectDismiss")}
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : null}

        {loading && !detail ? (
          <p className="text-sm text-slate-400">{t("inspectLoadingBody")}</p>
        ) : null}

        {detail ? (
          <div className="flex flex-col gap-5 text-sm">
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                {t("inspectSeasonSection")}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
                <div>
                  <dt className="text-slate-500">{t("inspectForm")}</dt>
                  <dd>{detail.profile.form ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("inspectTotalPoints")}</dt>
                  <dd>{detail.profile.total_points ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("inspectOwnership")}</dt>
                  <dd>
                    {detail.profile.ownership != null
                      ? `${detail.profile.ownership.toFixed(1)}%`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("inspectSeasonMins")}</dt>
                  <dd>{detail.profile.minutes_season ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("inspectGoalsAssists")}</dt>
                  <dd>
                    {detail.profile.goals_scored ?? 0} /{" "}
                    {detail.profile.assists ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("inspectTransfersNet")}</dt>
                  <dd>
                    {detail.profile.transfers_in_event != null &&
                    detail.profile.transfers_out_event != null
                      ? `${detail.profile.transfers_in_event} in · ${detail.profile.transfers_out_event} out`
                      : "—"}
                  </dd>
                </div>
              </dl>
              {detail.profile.news ? (
                <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-amber-100/90">
                  {detail.profile.news}
                </p>
              ) : null}
              {detail.availability.p < 1 && detail.availability.note ? (
                <p className="mt-2 text-xs text-rose-200/90">
                  {detail.availability.note} (
                  {Math.round(detail.availability.p * 100)}%)
                </p>
              ) : null}
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                {t("inspectRollingSection", { gws: detail.rolling.window_gws })}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300 sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">{t("inspectPts")}</dt>
                  <dd>{detail.rolling.points}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("inspectMinsRoll")}</dt>
                  <dd>{detail.rolling.minutes}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("inspectXgxa")}</dt>
                  <dd>
                    {detail.rolling.xg.toFixed(2)} /{" "}
                    {detail.rolling.xa.toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("inspectGA")}</dt>
                  <dd>
                    {detail.rolling.goals} / {detail.rolling.assists}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("inspectStarts")}</dt>
                  <dd>{detail.rolling.starts}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("inspectDcPts")}</dt>
                  <dd>{detail.rolling.dc_points}</dd>
                </div>
              </dl>
            </section>

            <section>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  {t("inspectFixturesSection")}
                </p>
                <span className="text-xs text-slate-400">
                  GW{detail.fromGw}–{detail.toGw} · Σ {detail.xp_total.toFixed(1)}{" "}
                  xP ({detail.xp_per_game.toFixed(2)}/{t("inspectPerGwShort")})
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-slate-400">
                      <th className="px-2 py-2">{t("inspectTblGw")}</th>
                      <th className="px-2 py-2">{t("inspectTblOpp")}</th>
                      <th className="px-2 py-2">{t("inspectTblFdr")}</th>
                      <th className="px-2 py-2 text-right">{t("inspectTblXp")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.fixtures.map((fx) => (
                      <tr
                        key={`${fx.gw}-${fx.opp_short}-${fx.home}`}
                        className="border-t border-white/5"
                      >
                        <td className="px-2 py-2 text-slate-300">
                          {fx.gw}
                        </td>
                        <td className="px-2 py-2 font-medium text-slate-200">
                          {fx.opp_short}
                          <span className="text-slate-500">
                            {fx.home ? " (H)" : " (A)"}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-slate-400">
                          {fx.fdr ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <span
                            className={cn(
                              "inline-block rounded px-2 py-0.5 font-semibold tabular-nums",
                              xpCellClass(fx.xp_total),
                            )}
                          >
                            {fx.xp_total.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                {t("inspectFixtureHint")}
              </p>
            </section>

            <div className="flex flex-wrap gap-2 pt-1">
              {showTransfer ? (
                <Button type="button" onClick={onTransfer}>
                  {t("inspectTransfer")}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={onClose}>
                {t("inspectDone")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
