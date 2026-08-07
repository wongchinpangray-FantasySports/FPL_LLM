"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type PlayerPerformanceProfile = {
  fpl_id: number;
  display_name: string;
  team: string | null;
  position: string | null;
  price: number | null;
  form: number | null;
  ownership: number | null;
  status: string | null;
  chance_of_playing: number | null;
  news: string | null;
  season: {
    total_points: number | null;
    minutes: number | null;
    goals: number | null;
    assists: number | null;
    clean_sheets: number | null;
    bonus: number | null;
    ict_index: number | null;
    threat: number | null;
    influence: number | null;
    creativity: number | null;
    expected_goals: number | null;
    expected_assists: number | null;
    defensive_contribution: number | null;
    defensive_contribution_per_90: number | null;
    points_per_game: number | null;
  };
  model: {
    current_gw: number;
    from_gw: number;
    to_gw: number;
    xp_total: number;
    xp_per_game: number;
    value_per_million: number | null;
    availability: number;
    availability_note: string | null;
    fixtures: Array<{
      gw: number;
      opp: string;
      home: boolean;
      fdr: number | null;
      expected_minutes: number;
      xp: number;
    }>;
  };
  recent_gws: Array<{
    gw: number;
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    bonus: number;
    total_points: number;
    expected_goals: number;
    expected_assists: number;
    defensive_contribution: number;
    ict_index: number;
  }>;
};

export type PlayerPerformanceModalLabels = {
  close: string;
  loading: string;
  error: string;
  openFullProfile: string;
  price: string;
  form: string;
  ownership: string;
  status: string;
  xpHorizon: string;
  valueXm: string;
  news: string;
  seasonSection: string;
  totalPts: string;
  minutes: string;
  goalsAssists: string;
  cleanSheets: string;
  ict: string;
  threat: string;
  defcon: string;
  ppg: string;
  recentTitle: string;
  fixturesTitle: string;
  colGw: string;
  colOpp: string;
  colMins: string;
  colPts: string;
  colXp: string;
  emptyGw: string;
};

function fmtNum(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
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
          highlight ? "font-semibold text-brand-accent" : "text-foreground/90",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function FplPlayerPerformanceModal({
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
  detail: PlayerPerformanceProfile | null;
  labels: PlayerPerformanceModalLabels;
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

  const s = detail?.season;
  const m = detail?.model;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fpl-player-perf-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label={labels.close}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-[101] flex max-h-[min(92vh,760px)] w-full flex-col",
          "rounded-t-2xl border border-border bg-background shadow-2xl sm:max-w-3xl sm:rounded-2xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id="fpl-player-perf-title"
              className="truncate text-lg font-semibold text-foreground"
            >
              {detail?.display_name ?? "…"}
            </h2>
            {detail ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {detail.team ?? "—"} · {detail.position ?? "—"}
                {m
                  ? ` · GW${m.from_gw}–${m.to_gw}`
                  : null}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {labels.close}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{labels.loading}</p>
          ) : null}
          {error ? (
            <p className="text-sm text-rose-300">{error || labels.error}</p>
          ) : null}

          {detail && !loading ? (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCell
                  label={labels.price}
                  value={
                    detail.price != null ? `£${detail.price.toFixed(1)}m` : "—"
                  }
                />
                <StatCell label={labels.form} value={fmtNum(detail.form, 1)} />
                <StatCell
                  label={labels.ownership}
                  value={
                    detail.ownership != null
                      ? `${fmtNum(detail.ownership, 1)}%`
                      : "—"
                  }
                />
                <StatCell
                  label={labels.status}
                  value={
                    detail.chance_of_playing != null &&
                    detail.chance_of_playing < 100
                      ? `${detail.status ?? "—"} · ${detail.chance_of_playing}%`
                      : (detail.status ?? "—")
                  }
                />
              </div>

              {m ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <StatCell
                    label={labels.xpHorizon}
                    value={`${fmtNum(m.xp_total, 1)} (${fmtNum(m.xp_per_game, 2)}/GW)`}
                    highlight
                  />
                  <StatCell
                    label={labels.valueXm}
                    value={fmtNum(m.value_per_million, 2)}
                  />
                  <StatCell
                    label={labels.ppg}
                    value={fmtNum(s?.points_per_game, 1)}
                  />
                </div>
              ) : null}

              {detail.news ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
                  <p className="text-[10px] font-medium uppercase text-amber-200/80">
                    {labels.news}
                  </p>
                  <p className="mt-1 leading-relaxed">{detail.news}</p>
                </div>
              ) : null}

              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {labels.seasonSection}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <StatCell
                    label={labels.totalPts}
                    value={s?.total_points ?? "—"}
                  />
                  <StatCell label={labels.minutes} value={s?.minutes ?? "—"} />
                  <StatCell
                    label={labels.goalsAssists}
                    value={`${s?.goals ?? 0} / ${s?.assists ?? 0}`}
                  />
                  <StatCell
                    label={labels.cleanSheets}
                    value={s?.clean_sheets ?? "—"}
                  />
                  <StatCell label={labels.ict} value={fmtNum(s?.ict_index, 1)} />
                  <StatCell label={labels.threat} value={fmtNum(s?.threat, 1)} />
                  <StatCell
                    label={labels.defcon}
                    value={
                      s?.defensive_contribution_per_90 != null
                        ? `${fmtNum(s.defensive_contribution_per_90, 1)}/90`
                        : (s?.defensive_contribution ?? "—")
                    }
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {labels.recentTitle}
                </h3>
                {detail.recent_gws.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {labels.emptyGw}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-2.5 py-2 font-medium">
                            {labels.colGw}
                          </th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">
                            {labels.colMins}
                          </th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">
                            {labels.colPts}
                          </th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">
                            G/A
                          </th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">
                            xG/xA
                          </th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">
                            DC
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...detail.recent_gws].reverse().map((g) => (
                          <tr
                            key={g.gw}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="px-2.5 py-1.5 font-medium">
                              {g.gw}
                            </td>
                            <td className="px-2.5 py-1.5 tabular-nums">
                              {g.minutes}
                            </td>
                            <td className="px-2.5 py-1.5 tabular-nums font-medium">
                              {g.total_points}
                            </td>
                            <td className="px-2.5 py-1.5 tabular-nums">
                              {g.goals_scored}/{g.assists}
                            </td>
                            <td className="px-2.5 py-1.5 tabular-nums">
                              {fmtNum(g.expected_goals, 2)}/
                              {fmtNum(g.expected_assists, 2)}
                            </td>
                            <td className="px-2.5 py-1.5 tabular-nums">
                              {g.defensive_contribution}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {m && m.fixtures.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    {labels.fixturesTitle}
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-2.5 py-2 font-medium">
                            {labels.colGw}
                          </th>
                          <th className="px-2.5 py-2 font-medium">
                            {labels.colOpp}
                          </th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">
                            {labels.colMins}
                          </th>
                          <th className="px-2.5 py-2 font-medium tabular-nums">
                            {labels.colXp}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.fixtures.map((f) => (
                          <tr
                            key={`${f.gw}-${f.opp}-${f.home ? "H" : "A"}`}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="px-2.5 py-1.5 font-medium">{f.gw}</td>
                            <td className="px-2.5 py-1.5">
                              {f.home ? "vs" : "@"} {f.opp}
                              {f.fdr != null ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · FDR {f.fdr}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2.5 py-1.5 tabular-nums">
                              {fmtNum(f.expected_minutes, 0)}
                            </td>
                            <td className="px-2.5 py-1.5 tabular-nums font-medium text-brand-accent">
                              {fmtNum(f.xp, 1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>

        {detail ? (
          <div className="flex shrink-0 justify-end border-t border-border px-5 py-3">
            <Link
              href={`/player/${detail.fpl_id}`}
              className="text-sm text-brand-accent no-underline hover:underline"
              onClick={onClose}
            >
              {labels.openFullProfile}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
