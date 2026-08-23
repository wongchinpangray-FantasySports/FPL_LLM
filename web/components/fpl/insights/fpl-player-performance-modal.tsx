"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  PlayerShotMap,
  type PlayerShotMapLabels,
} from "@/components/player/player-shot-map";
import { PlayerGwBarChart } from "@/components/player/player-gw-bar-chart";
import type { PlayerShotMapData } from "@/lib/fpl/understat-shots";
import type { PlayerGwHistoryRow } from "@/lib/player-gw-history";
import type { PriceForecastStatus } from "@/lib/fpl/insights/price-forecast";
import { getFplTeamBadgeStyle, getFplTeamTheme } from "@/lib/team-themes";

export type PlayerPriceForecastBrief = {
  gw: number;
  source: "live" | "db";
  transfers_in: number;
  transfers_out: number;
  net_transfers: number;
  progress: number;
  status: PriceForecastStatus;
  cost_change_event: number;
  threshold: number;
};

export type PlayerPerformanceProfile = {
  fpl_id: number;
  display_name: string;
  team: string | null;
  team_short?: string | null;
  position: string | null;
  price: number | null;
  form: number | null;
  ownership: number | null;
  status: string | null;
  chance_of_playing: number | null;
  news: string | null;
  season_label?: string | null;
  season: {
    source?: "live" | "db";
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
    defcon_points?: number;
    fixture?: {
      opp: string;
      home: boolean;
      fdr: number | null;
    } | null;
  }>;
  shot_map?: PlayerShotMapData | null;
  price_forecast?: PlayerPriceForecastBrief | null;
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
  seasonLive: string;
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
  colPlayedMins: string;
  colMins: string;
  colPts: string;
  colXp: string;
  colDcPts: string;
  emptyGw: string;
  shotMap?: PlayerShotMapLabels;
  priceForecast?: {
    title: string;
    netTransfers: string;
    transfersInOut: string;
    progress: string;
    status: string;
    alreadyUp: string;
    alreadyDown: string;
    statusLikelyRise: string;
    statusWatchRise: string;
    statusLikelyFall: string;
    statusWatchFall: string;
    statusStable: string;
  };
};

function fmtNum(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

function fmtTransferInt(v: number): string {
  const abs = Math.abs(v);
  const body =
    abs >= 1_000_000
      ? `${(abs / 1_000_000).toFixed(2)}m`
      : abs >= 1000
        ? `${(abs / 1000).toFixed(0)}k`
        : String(abs);
  if (v > 0) return `+${body}`;
  if (v < 0) return `-${body}`;
  return "0";
}

function deltaClass(v: number): string {
  if (Math.abs(v) < 0.05) return "text-muted-foreground";
  return v > 0 ? "text-emerald-400" : "text-red-400";
}

function priceStatusTone(status: PriceForecastStatus): string {
  switch (status) {
    case "likely_rise":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "watch_rise":
      return "border-emerald-500/20 bg-emerald-500/5 text-emerald-300/80";
    case "likely_fall":
      return "border-red-500/30 bg-red-500/10 text-red-400";
    case "watch_fall":
      return "border-red-500/20 bg-red-500/5 text-red-300/80";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function formatRecentFixture(
  fixture: PlayerPerformanceProfile["recent_gws"][number]["fixture"],
): string {
  if (!fixture?.opp) return "—";
  const prefix = fixture.home ? "vs" : "@";
  const fdr =
    fixture.fdr != null && fixture.fdr > 0 ? ` · FDR ${fixture.fdr}` : "";
  return `${prefix} ${fixture.opp}${fdr}`;
}

/** Map modal recent GWs into chart rows (ascending by GW). */
function recentGwsToChartRows(
  recent: PlayerPerformanceProfile["recent_gws"],
): PlayerGwHistoryRow[] {
  return [...recent]
    .slice()
    .sort((a, b) => a.gw - b.gw)
    .map((g) => ({
      gw: g.gw,
      minutes: g.minutes,
      goals_scored: g.goals_scored,
      assists: g.assists,
      clean_sheets: g.clean_sheets,
      saves: 0,
      bonus: g.bonus,
      bps: 0,
      expected_goals: g.expected_goals,
      expected_assists: g.expected_assists,
      total_points: g.total_points,
      ict_index: g.ict_index,
      defensive_contribution: g.defensive_contribution,
      defcon_points: g.defcon_points,
      fixture: g.fixture ?? null,
    }));
}

function TeamThemeChip({
  code,
  name,
}: {
  code: string;
  name?: string | null;
}) {
  const badge = getFplTeamBadgeStyle(code);
  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm"
      style={{
        background: badge.chipBg,
        color: badge.color,
        borderColor: badge.chipBorder,
      }}
      title={name ?? code}
    >
      {code}
    </span>
  );
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
  const pf = detail?.price_forecast;
  const pfLabels = labels.priceForecast;

  const priceStatusLabel = (status: PriceForecastStatus): string => {
    if (!pfLabels) return status;
    switch (status) {
      case "likely_rise":
        return pfLabels.statusLikelyRise;
      case "watch_rise":
        return pfLabels.statusWatchRise;
      case "likely_fall":
        return pfLabels.statusLikelyFall;
      case "watch_fall":
        return pfLabels.statusWatchFall;
      default:
        return pfLabels.statusStable;
    }
  };

  const teamShort = detail?.team_short ?? null;
  const teamTheme = getFplTeamTheme(teamShort);
  const teamBadge = getFplTeamBadgeStyle(teamShort);
  const hasTeamTheme = Boolean(teamShort);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4"
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
          "relative z-[111] flex max-h-[min(92vh,760px)] w-full flex-col overflow-hidden",
          "rounded-t-2xl border bg-background shadow-2xl sm:max-w-3xl sm:rounded-2xl",
        )}
        style={
          hasTeamTheme
            ? {
                borderColor: teamBadge.chipBorder,
                background: `linear-gradient(180deg, ${teamTheme.primary}18 0%, ${teamTheme.secondary}08 22%, transparent 48%)`,
              }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
      >
        {hasTeamTheme ? (
          <div
            className="h-1 shrink-0"
            style={{
              background: `linear-gradient(90deg, ${teamTheme.primary} 0%, ${teamTheme.secondary} 55%, ${teamTheme.primary} 100%)`,
            }}
          />
        ) : null}
        <div
          className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4"
          style={
            hasTeamTheme
              ? {
                  borderColor: teamBadge.chipBorder,
                  background: `linear-gradient(135deg, ${teamTheme.primary}24 0%, ${teamTheme.secondary}14 55%, transparent 100%)`,
                }
              : { borderColor: "hsl(var(--border))" }
          }
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {teamShort ? (
                <TeamThemeChip code={teamShort} name={detail?.team} />
              ) : null}
              <h2
                id="fpl-player-perf-title"
                className="truncate text-lg font-semibold text-foreground"
              >
                {detail?.display_name ?? "…"}
              </h2>
            </div>
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

              {pf && pfLabels ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    {pfLabels.title}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      GW{pf.gw}
                    </span>
                  </h3>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          priceStatusTone(pf.status),
                        )}
                      >
                        {priceStatusLabel(pf.status)}
                      </span>
                      {pf.cost_change_event > 0 ? (
                        <span className="text-[10px] font-medium text-emerald-400">
                          {pfLabels.alreadyUp}
                        </span>
                      ) : null}
                      {pf.cost_change_event < 0 ? (
                        <span className="text-[10px] font-medium text-red-400">
                          {pfLabels.alreadyDown}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <StatCell
                        label={pfLabels.netTransfers}
                        value={fmtTransferInt(pf.net_transfers)}
                        highlight
                      />
                      <StatCell
                        label={pfLabels.transfersInOut}
                        value={`${pf.transfers_in.toLocaleString()} / ${pf.transfers_out.toLocaleString()}`}
                      />
                      <StatCell
                        label={pfLabels.progress}
                        value={`${Math.round(Math.abs(pf.progress) * 100)}%`}
                      />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={
                            pf.progress >= 0
                              ? "h-full bg-emerald-400"
                              : "h-full bg-red-400"
                          }
                          style={{
                            width: `${Math.min(100, Math.abs(pf.progress) * 100)}%`,
                          }}
                        />
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium tabular-nums",
                          deltaClass(pf.progress),
                        )}
                      >
                        {pf.progress >= 0 ? "+" : "−"}
                        {Math.round(Math.abs(pf.progress) * 100)}%
                      </span>
                    </div>
                  </div>
                </section>
              ) : null}

              <section>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {detail.season_label
                      ? labels.seasonSection.replace(
                          "{season}",
                          detail.season_label,
                        )
                      : labels.seasonSection.replace("{season}", "—")}
                  </h3>
                  {s?.source === "live" ? (
                    <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                      {labels.seasonLive}
                    </span>
                  ) : null}
                </div>
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

              {labels.shotMap && detail.shot_map ? (
                <PlayerShotMap
                  shots={detail.shot_map.shots}
                  totals={detail.shot_map.totals}
                  season={detail.shot_map.season}
                  coverage={detail.shot_map.coverage}
                  labels={labels.shotMap}
                  variant="compact"
                  className="border-border/80 bg-card/40 p-3 sm:p-4"
                />
              ) : null}

              {detail.recent_gws.length > 0 ? (
                <PlayerGwBarChart
                  rows={recentGwsToChartRows(detail.recent_gws)}
                />
              ) : null}

              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {labels.recentTitle}
                </h3>
                {detail.recent_gws.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {labels.emptyGw}
                  </p>
                ) : (
                  <div className="scroll-table scroll-table--bordered scroll-table--muted">
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
                            {labels.colPlayedMins}
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
                          <th className="px-2.5 py-2 font-medium tabular-nums">
                            {labels.colDcPts}
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
                            <td className="px-2.5 py-1.5 text-muted-foreground">
                              {formatRecentFixture(g.fixture)}
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
                            <td
                              className={cn(
                                "px-2.5 py-1.5 tabular-nums font-medium",
                                (g.defcon_points ?? 0) > 0
                                  ? "text-emerald-400"
                                  : "text-muted-foreground",
                              )}
                            >
                              {(g.defcon_points ?? 0) > 0
                                ? `+${g.defcon_points}`
                                : "0"}
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
                  <div className="scroll-table scroll-table--bordered scroll-table--muted">
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
