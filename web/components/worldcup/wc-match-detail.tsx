"use client";

import { cn } from "@/lib/utils";
import type {
  WcMatchCardEvent,
  WcMatchGoal,
  WcMatchRow,
  WcTeamMatchStats,
} from "@/lib/wc/fifa-rounds";
import { wcTeamFlag } from "@/lib/wc/wc-team-flags";

function GoalIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px]",
        className,
      )}
      aria-hidden
    >
      ⚽
    </span>
  );
}

function CardIcon({ card }: { card: "yellow" | "red" }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-3 shrink-0 rounded-sm",
        card === "red" ? "bg-rose-500" : "bg-amber-400",
      )}
      aria-hidden
    />
  );
}

function fmtMinute(minute: string | null): string {
  if (!minute) return "";
  return minute.includes("'") ? minute : `${minute}'`;
}

function HomeGoalRow({
  goal,
  assistLabel,
}: {
  goal: WcMatchGoal;
  assistLabel: string;
}) {
  return (
    <div className="flex items-start justify-end gap-2">
      <div className="min-w-0 text-right">
        <div className="text-sm leading-snug text-slate-200">
          {goal.minute ? (
            <span className="mr-1.5 tabular-nums text-slate-400">
              {fmtMinute(goal.minute)}
            </span>
          ) : null}
          <span className="font-medium">{goal.scorer_display}</span>
        </div>
        {goal.assist_display ? (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {assistLabel}: {goal.assist_display}
          </p>
        ) : null}
      </div>
      <GoalIcon className="mt-0.5" />
    </div>
  );
}

function AwayGoalRow({
  goal,
  assistLabel,
}: {
  goal: WcMatchGoal;
  assistLabel: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <GoalIcon className="mt-0.5" />
      <div className="min-w-0 text-left">
        <div className="text-sm leading-snug text-slate-200">
          <span className="font-medium">{goal.scorer_display}</span>
          {goal.minute ? (
            <span className="ml-1.5 tabular-nums text-slate-400">
              {fmtMinute(goal.minute)}
            </span>
          ) : null}
        </div>
        {goal.assist_display ? (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {assistLabel}: {goal.assist_display}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function HomeCardRow({ event }: { event: WcMatchCardEvent }) {
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-slate-300">
      {event.minute ? (
        <span className="tabular-nums text-slate-400">
          {fmtMinute(event.minute)}
        </span>
      ) : null}
      <span className="font-medium">{event.player_display}</span>
      <CardIcon card={event.card} />
    </div>
  );
}

function AwayCardRow({ event }: { event: WcMatchCardEvent }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <CardIcon card={event.card} />
      <span className="font-medium">{event.player_display}</span>
      {event.minute ? (
        <span className="tabular-nums text-slate-400">
          {fmtMinute(event.minute)}
        </span>
      ) : null}
    </div>
  );
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
    noStats: string;
    xg: string;
    shots: string;
    shotsOn: string;
    possession: string;
    corners: string;
    fouls: string;
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
    <div className="space-y-2.5 rounded-lg bg-white/[0.02] p-3">
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

export function WcMatchDetail({
  match,
  labels,
  statsLoading,
}: {
  match: WcMatchRow;
  statsLoading?: boolean;
  labels: {
    fullTime: string;
    assist: string;
    noStats: string;
    statsPending: string;
    xg: string;
    shots: string;
    shotsOn: string;
    possession: string;
    corners: string;
    fouls: string;
  };
}) {
  const finished =
    match.status.toLowerCase() === "finished" ||
    match.status.toLowerCase() === "complete" ||
    match.home_score != null;

  const homeGoals = match.home_goals ?? [];
  const awayGoals = match.away_goals ?? [];
  const homeCards = match.home_cards ?? [];
  const awayCards = match.away_cards ?? [];

  const homeEvents = [
    ...homeGoals.map((g) => ({ kind: "goal" as const, sort: g.sort_key, g })),
    ...homeCards.map((c) => ({ kind: "card" as const, sort: c.sort_key, c })),
  ].sort((a, b) => b.sort - a.sort);

  const awayEvents = [
    ...awayGoals.map((g) => ({ kind: "goal" as const, sort: g.sort_key, g })),
    ...awayCards.map((c) => ({ kind: "card" as const, sort: c.sort_key, c })),
  ].sort((a, b) => b.sort - a.sort);

  const hasEvents = homeEvents.length > 0 || awayEvents.length > 0;
  const homeStats = match.home_stats;
  const awayStats = match.away_stats;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate text-right text-xs font-bold uppercase tracking-wide text-white sm:text-sm">
              {match.home_name}
            </span>
            <span className="text-lg leading-none">{wcTeamFlag(match.home_code)}</span>
          </div>

          <div className="px-2 text-center">
            {finished ? (
              <>
                <div className="text-xl font-bold tabular-nums text-white sm:text-2xl">
                  {match.home_score ?? 0}
                  <span className="mx-1.5 font-normal text-slate-500">-</span>
                  {match.away_score ?? 0}
                </div>
                <span className="mt-1 inline-block rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-900">
                  {labels.fullTime}
                </span>
              </>
            ) : (
              <div className="text-sm text-slate-500">vs</div>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg leading-none">{wcTeamFlag(match.away_code)}</span>
            <span className="truncate text-left text-xs font-bold uppercase tracking-wide text-white sm:text-sm">
              {match.away_name}
            </span>
          </div>
        </div>

        {hasEvents ? (
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/[0.06] pt-3">
            <div className="space-y-2.5">
              {homeEvents.map((ev, i) =>
                ev.kind === "goal" ? (
                  <HomeGoalRow
                    key={`hg-${i}`}
                    goal={ev.g}
                    assistLabel={labels.assist}
                  />
                ) : (
                  <HomeCardRow key={`hc-${i}`} event={ev.c} />
                ),
              )}
            </div>
            <div className="space-y-2.5">
              {awayEvents.map((ev, i) =>
                ev.kind === "goal" ? (
                  <AwayGoalRow
                    key={`ag-${i}`}
                    goal={ev.g}
                    assistLabel={labels.assist}
                  />
                ) : (
                  <AwayCardRow key={`ac-${i}`} event={ev.c} />
                ),
              )}
            </div>
          </div>
        ) : null}
      </div>

      {match.stats_available && homeStats && awayStats ? (
        <StatsBlock homeStats={homeStats} awayStats={awayStats} labels={labels} />
      ) : statsLoading ? (
        <p className="text-center text-xs text-slate-500">{labels.statsPending}</p>
      ) : finished ? (
        <p className="text-center text-xs text-slate-500">{labels.noStats}</p>
      ) : null}
    </div>
  );
}
