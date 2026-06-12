"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { WcMatchRow, WcTeamMatchStats } from "@/lib/wc/fifa-rounds";
import { WcSectionIntro } from "@/components/worldcup/wc-shared";

function fmtKickoff(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusLabel(status: string, period: string | null, minutes: number): string {
  const s = status.toLowerCase();
  if (s === "finished" || s === "complete") return "FT";
  if (s === "scheduled") return "Scheduled";
  if (period && minutes > 0) return `${minutes}'`;
  return status.replace(/_/g, " ");
}

function StatCompare({
  label,
  home,
  away,
  suffix = "",
}: {
  label: string;
  home: number | null;
  away: number | null;
  suffix?: string;
}) {
  if (home == null && away == null) return null;
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a || 1;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs tabular-nums text-slate-300">
        <span>{home != null ? `${h}${suffix}` : "—"}</span>
        <span className="text-[10px] uppercase text-slate-500">{label}</span>
        <span>{away != null ? `${a}${suffix}` : "—"}</span>
      </div>
      <div className="flex h-1 overflow-hidden rounded-full bg-white/5">
        <div
          className="bg-brand-accent/70"
          style={{ width: `${(h / total) * 100}%` }}
        />
        <div
          className="bg-slate-500/50"
          style={{ width: `${(a / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function StatsBlock({
  homeStats,
  awayStats,
  labels,
}: {
  homeStats: WcTeamMatchStats;
  awayStats: WcTeamMatchStats;
  labels: {
    xg: string;
    shots: string;
    shotsOn: string;
    possession: string;
    corners: string;
    fouls: string;
    noStats: string;
  };
}) {
  const hasAny =
    homeStats.xg != null ||
    homeStats.shots != null ||
    homeStats.possession != null;
  if (!hasAny) {
    return <p className="text-xs text-slate-500">{labels.noStats}</p>;
  }
  return (
    <div className="space-y-2.5">
      <StatCompare label={labels.xg} home={homeStats.xg} away={awayStats.xg} />
      <StatCompare
        label={labels.shots}
        home={homeStats.shots}
        away={awayStats.shots}
      />
      <StatCompare
        label={labels.shotsOn}
        home={homeStats.shots_on_target}
        away={awayStats.shots_on_target}
      />
      <StatCompare
        label={labels.possession}
        home={homeStats.possession}
        away={awayStats.possession}
        suffix="%"
      />
      <StatCompare
        label={labels.corners}
        home={homeStats.corners}
        away={awayStats.corners}
      />
      <StatCompare
        label={labels.fouls}
        home={homeStats.fouls}
        away={awayStats.fouls}
      />
    </div>
  );
}

function MatchCard({
  match,
  expanded,
  onToggle,
  statsLoading,
  labels,
}: {
  match: WcMatchRow;
  expanded: boolean;
  onToggle: () => void;
  statsLoading: boolean;
  labels: {
    expandHint: string;
    venue: string;
    scorers: string;
    noStats: string;
    xg: string;
    shots: string;
    shotsOn: string;
    possession: string;
    corners: string;
    fouls: string;
    statsPending: string;
  };
}) {
  const live =
    match.status !== "scheduled" &&
    match.status !== "finished" &&
    match.minutes > 0;
  const finished =
    match.status.toLowerCase() === "finished" ||
    match.status.toLowerCase() === "complete" ||
    match.home_score != null;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "cursor-pointer rounded-lg border p-3 transition-colors",
        expanded
          ? "border-brand-accent/30 bg-white/[0.05]"
          : "border-white/[0.06] bg-slate-950/40 hover:border-white/12",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{match.round_label}</span>
        <span
          className={cn(
            live && "font-medium text-brand-accent",
            finished && "text-slate-400",
          )}
        >
          {statusLabel(match.status, match.period, match.minutes)}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0 text-right">
          <div className="truncate text-sm font-semibold text-white">
            {match.home_name}
          </div>
          <div className="text-[10px] text-slate-500">{match.home_code}</div>
        </div>
        <div className="px-2 text-center">
          {finished ? (
            <div className="text-lg font-bold tabular-nums text-white">
              {match.home_score ?? 0}
              <span className="mx-1 text-slate-500">–</span>
              {match.away_score ?? 0}
            </div>
          ) : (
            <div className="text-xs text-slate-500">vs</div>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {match.away_name}
          </div>
          <div className="text-[10px] text-slate-500">{match.away_code}</div>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {fmtKickoff(match.kickoff)}
        {match.venue ? ` · ${match.venue}` : ""}
      </p>

      {!expanded ? (
        <p className="mt-2 text-center text-xs text-slate-600">
          {labels.expandHint}
        </p>
      ) : (
        <div
          className="mt-3 space-y-3 border-t border-white/10 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {match.home_scorers || match.away_scorers ? (
            <div className="space-y-1 text-xs text-slate-400">
              <div className="text-[10px] uppercase text-slate-500">
                {labels.scorers}
              </div>
              {match.home_scorers ? (
                <p>
                  <span className="text-slate-500">{match.home_code}:</span>{" "}
                  {match.home_scorers}
                </p>
              ) : null}
              {match.away_scorers ? (
                <p>
                  <span className="text-slate-500">{match.away_code}:</span>{" "}
                  {match.away_scorers}
                </p>
              ) : null}
            </div>
          ) : null}

          {match.stats_available && match.home_stats && match.away_stats ? (
            <StatsBlock
              homeStats={match.home_stats}
              awayStats={match.away_stats}
              labels={labels}
            />
          ) : statsLoading ? (
            <p className="text-xs text-slate-500">{labels.statsPending}</p>
          ) : (
            <p className="text-xs text-slate-500">{labels.noStats}</p>
          )}
        </div>
      )}
    </article>
  );
}

type MatchesPayload = {
  rounds: number[];
  matches: WcMatchRow[];
  stats_for: WcMatchRow | null;
  stats_provider: string | null;
  disclaimer: string;
  error?: string;
};

export function WcMatchesPanel({
  title,
  summary,
  detail,
  moreLabel,
  labels,
}: {
  title: string;
  summary: string;
  detail?: string;
  moreLabel: string;
  labels: {
    filterRound: string;
    roundAll: string;
    expandHint: string;
    venue: string;
    scorers: string;
    noStats: string;
    statsPending: string;
    xg: string;
    shots: string;
    shotsOn: string;
    possession: string;
    corners: string;
    fouls: string;
    loading: string;
    empty: string;
  };
}) {
  const [round, setRound] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MatchesPayload | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statsLoadingId, setStatsLoadingId] = useState<number | null>(null);
  const [statsById, setStatsById] = useState<Map<number, WcMatchRow>>(
    () => new Map(),
  );

  const load = useCallback(async (roundFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const q =
        roundFilter === "ALL"
          ? ""
          : `?round=${encodeURIComponent(roundFilter)}`;
      const res = await fetch(`/api/worldcup/matches${q}`);
      const json = (await res.json()) as MatchesPayload;
      if (!res.ok) throw new Error(json.error ?? "Failed to load matches");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(round);
  }, [load, round]);

  const loadStats = useCallback(
    async (id: number) => {
      setStatsLoadingId(id);
      try {
        const res = await fetch(
          `/api/worldcup/matches?statsFor=${encodeURIComponent(String(id))}`,
        );
        const json = (await res.json()) as MatchesPayload;
        if (json.stats_for) {
          setStatsById((prev) => new Map(prev).set(id, json.stats_for!));
        }
      } finally {
        setStatsLoadingId(null);
      }
    },
    [],
  );

  const matches = (data?.matches ?? []).map(
    (m) => statsById.get(m.id) ?? m,
  );

  const roundOptions = [
    { value: "ALL", label: labels.roundAll },
    ...(data?.rounds ?? []).map((r) => ({
      value: String(r),
      label: r <= 3 ? `MD${r}` : r === 8 ? "Final" : `R${r}`,
    })),
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <WcSectionIntro
          title={title}
          summary={summary}
          detail={detail}
          moreLabel={moreLabel}
        />
        <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
          <span>{labels.filterRound}</span>
          <select
            value={round}
            onChange={(e) => setRound(e.target.value)}
            className="rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-sm text-white"
          >
            {roundOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">{labels.loading}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {!loading && !error && matches.length === 0 ? (
        <p className="text-sm text-slate-500">{labels.empty}</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {matches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            expanded={expandedId === m.id}
            onToggle={() => {
              const next = expandedId === m.id ? null : m.id;
              setExpandedId(next);
              if (
                next === m.id &&
                !m.stats_available &&
                (m.status.toLowerCase() === "finished" ||
                  m.status.toLowerCase() === "complete" ||
                  m.home_score != null)
              ) {
                void loadStats(m.id);
              }
            }}
            statsLoading={statsLoadingId === m.id}
            labels={labels}
          />
        ))}
      </div>
    </section>
  );
}
