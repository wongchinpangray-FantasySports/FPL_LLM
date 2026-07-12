"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HistoricalPlayerDetail } from "@/lib/fpl/historical-data";

type ModalLabels = {
  close: string;
  loading: string;
  error: string;
  seasonRange: string;
  summaryTitle: string;
  gwBreakdownTitle: string;
  noGameweeks: string;
  viewCurrentProfile: string;
  colGw: string;
  colMins: string;
  colPts: string;
  colGoals: string;
  colAssists: string;
  colCs: string;
  colBonus: string;
  colXg: string;
  colXa: string;
  colIct: string;
  colApps: string;
  colBps: string;
  colDefcon: string;
  colPts90: string;
  colOpponent: string;
  dgw: string;
  bgw: string;
};

function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toFixed(digits);
}

function GwBadge({
  label,
  tone,
}: {
  label: string;
  tone: "dgw" | "bgw";
}) {
  return (
    <span
      className={cn(
        "rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide",
        tone === "dgw" && "bg-amber-500/20 text-amber-300",
        tone === "bgw" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function statCell(v: number | string, kind: "played" | "bgw") {
  if (kind === "bgw") return "—";
  return v;
}

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm tabular-nums",
          highlight ? "font-semibold text-foreground" : "text-foreground/90",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function FplHistoricalPlayerModal({
  open,
  loading,
  error,
  detail,
  labels,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: HistoricalPlayerDetail | null;
  labels: ModalLabels;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const name = detail?.summary.web_name || detail?.summary.name || "—";
  const seasonRange = detail
    ? labels.seasonRange
        .replace("{season}", detail.seasonLabel)
        .replace("{from}", String(detail.gwFrom))
        .replace("{to}", String(detail.gwTo))
    : "";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fpl-historical-player-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label={labels.close}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-[101] flex max-h-[min(90vh,720px)] w-full flex-col",
          "rounded-t-2xl border border-border bg-background shadow-2xl sm:max-w-3xl sm:rounded-2xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id="fpl-historical-player-title"
              className="truncate text-base font-semibold text-foreground sm:text-lg"
            >
              {loading ? labels.loading : name}
            </h2>
            {detail ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.summary.team} · {detail.summary.position}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{seasonRange}</p>
              </>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            {labels.close}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{labels.loading}</p>
          ) : error ? (
            <p className="text-sm text-rose-400">{error || labels.error}</p>
          ) : detail ? (
            <div className="flex flex-col gap-5">
              <section>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {labels.summaryTitle}
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  <StatCell label={labels.colApps} value={detail.summary.appearances} />
                  <StatCell label={labels.colMins} value={detail.summary.minutes} />
                  <StatCell
                    label={labels.colPts}
                    value={detail.summary.total_points}
                    highlight
                  />
                  <StatCell label={labels.colGoals} value={detail.summary.goals_scored} />
                  <StatCell label={labels.colAssists} value={detail.summary.assists} />
                  <StatCell label={labels.colCs} value={detail.summary.clean_sheets} />
                  <StatCell label={labels.colBonus} value={detail.summary.bonus} />
                  <StatCell
                    label={labels.colXg}
                    value={fmtNum(detail.summary.expected_goals, 2)}
                  />
                  <StatCell
                    label={labels.colXa}
                    value={fmtNum(detail.summary.expected_assists, 2)}
                  />
                  <StatCell
                    label={labels.colIct}
                    value={fmtNum(detail.summary.ict_index, 1)}
                  />
                  <StatCell
                    label={labels.colPts90}
                    value={fmtNum(detail.summary.points_per90, 2)}
                  />
                  <StatCell label={labels.colBps} value={detail.summary.bps} />
                  <StatCell
                    label={labels.colDefcon}
                    value={detail.summary.defensive_contribution}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {labels.gwBreakdownTitle}
                </h3>
                {detail.gameweeks.length ? (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-2.5 py-2 font-medium">{labels.colGw}</th>
                          <th className="px-2.5 py-2 font-medium">{labels.colOpponent}</th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">{labels.colMins}</th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">{labels.colPts}</th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">{labels.colGoals}</th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">{labels.colAssists}</th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">{labels.colCs}</th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">{labels.colBonus}</th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">{labels.colXg}</th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">{labels.colXa}</th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">{labels.colIct}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.gameweeks.map((gw) => (
                          <tr
                            key={`${gw.gw}-${gw.kind}`}
                            className={cn(
                              "border-b border-border/60 last:border-0",
                              gw.kind === "bgw" && "bg-muted/15 text-muted-foreground",
                            )}
                          >
                            <td className="px-2.5 py-2 font-medium tabular-nums">
                              <div className="flex items-center gap-1.5">
                                <span>{gw.gw}</span>
                                {gw.kind === "bgw" ? (
                                  <GwBadge label={labels.bgw} tone="bgw" />
                                ) : null}
                                {gw.isDgw ? (
                                  <GwBadge label={labels.dgw} tone="dgw" />
                                ) : null}
                              </div>
                            </td>
                            <td className="px-2.5 py-2 text-foreground/90">
                              {gw.opponent}
                            </td>
                            <td className="px-2.5 py-2 tabular-nums text-muted-foreground">
                              {statCell(gw.minutes, gw.kind)}
                            </td>
                            <td className="px-2.5 py-2 tabular-nums font-semibold text-foreground">
                              {statCell(gw.total_points, gw.kind)}
                            </td>
                            <td className="px-2.5 py-2 tabular-nums">
                              {statCell(gw.goals_scored, gw.kind)}
                            </td>
                            <td className="px-2.5 py-2 tabular-nums">
                              {statCell(gw.assists, gw.kind)}
                            </td>
                            <td className="px-2.5 py-2 tabular-nums">
                              {statCell(gw.clean_sheets, gw.kind)}
                            </td>
                            <td className="px-2.5 py-2 tabular-nums">
                              {statCell(gw.bonus, gw.kind)}
                            </td>
                            <td className="px-2.5 py-2 tabular-nums">
                              {gw.kind === "bgw"
                                ? "—"
                                : fmtNum(gw.expected_goals, 2)}
                            </td>
                            <td className="px-2.5 py-2 tabular-nums">
                              {gw.kind === "bgw"
                                ? "—"
                                : fmtNum(gw.expected_assists, 2)}
                            </td>
                            <td className="px-2.5 py-2 tabular-nums">
                              {gw.kind === "bgw"
                                ? "—"
                                : fmtNum(gw.ict_index, 1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{labels.noGameweeks}</p>
                )}
              </section>

              {detail.hasCurrentProfile ? (
                <p>
                  <Link
                    href={`/player/${detail.summary.fpl_id}`}
                    className="text-sm font-medium text-brand-accent hover:underline"
                  >
                    {labels.viewCurrentProfile}
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
