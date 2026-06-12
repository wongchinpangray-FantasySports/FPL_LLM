"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { WcPlayerMatchStats } from "@/lib/wc/api-football-stats";
import type {
  WcMatchCardEvent,
  WcMatchGoal,
  WcMatchRow,
  WcTeamMatchStats,
} from "@/lib/wc/fifa-rounds";
import { wcTeamFlag } from "@/lib/wc/wc-team-flags";
import { WcStatChip } from "@/components/worldcup/wc-shared";

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

function fmtStat(v: number | null, suffix = ""): string {
  if (v == null) return "—";
  return `${v}${suffix}`;
}

function PlayerNameButton({
  name,
  display,
  selected,
  onSelect,
}: {
  name: string;
  display: string;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(name);
      }}
      className={cn(
        "font-medium underline-offset-2 transition-colors hover:text-brand-accent hover:underline",
        selected && "text-brand-accent underline",
      )}
    >
      {display}
    </button>
  );
}

function HomeGoalRow({
  goal,
  assistLabel,
  selectedPlayer,
  onSelectPlayer,
}: {
  goal: WcMatchGoal;
  assistLabel: string;
  selectedPlayer: string | null;
  onSelectPlayer: (name: string) => void;
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
          <PlayerNameButton
            name={goal.scorer}
            display={goal.scorer_display}
            selected={selectedPlayer === goal.scorer}
            onSelect={onSelectPlayer}
          />
        </div>
        {goal.assist && goal.assist_display ? (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {assistLabel}:{" "}
            <PlayerNameButton
              name={goal.assist}
              display={goal.assist_display}
              selected={selectedPlayer === goal.assist}
              onSelect={onSelectPlayer}
            />
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
  selectedPlayer,
  onSelectPlayer,
}: {
  goal: WcMatchGoal;
  assistLabel: string;
  selectedPlayer: string | null;
  onSelectPlayer: (name: string) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <GoalIcon className="mt-0.5" />
      <div className="min-w-0 text-left">
        <div className="text-sm leading-snug text-slate-200">
          <PlayerNameButton
            name={goal.scorer}
            display={goal.scorer_display}
            selected={selectedPlayer === goal.scorer}
            onSelect={onSelectPlayer}
          />
          {goal.minute ? (
            <span className="ml-1.5 tabular-nums text-slate-400">
              {fmtMinute(goal.minute)}
            </span>
          ) : null}
        </div>
        {goal.assist && goal.assist_display ? (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {assistLabel}:{" "}
            <PlayerNameButton
              name={goal.assist}
              display={goal.assist_display}
              selected={selectedPlayer === goal.assist}
              onSelect={onSelectPlayer}
            />
          </p>
        ) : null}
      </div>
    </div>
  );
}

function HomeCardRow({
  event,
  selectedPlayer,
  onSelectPlayer,
}: {
  event: WcMatchCardEvent;
  selectedPlayer: string | null;
  onSelectPlayer: (name: string) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-slate-300">
      {event.minute ? (
        <span className="tabular-nums text-slate-400">
          {fmtMinute(event.minute)}
        </span>
      ) : null}
      <PlayerNameButton
        name={event.player}
        display={event.player_display}
        selected={selectedPlayer === event.player}
        onSelect={onSelectPlayer}
      />
      <CardIcon card={event.card} />
    </div>
  );
}

function AwayCardRow({
  event,
  selectedPlayer,
  onSelectPlayer,
}: {
  event: WcMatchCardEvent;
  selectedPlayer: string | null;
  onSelectPlayer: (name: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <CardIcon card={event.card} />
      <PlayerNameButton
        name={event.player}
        display={event.player_display}
        selected={selectedPlayer === event.player}
        onSelect={onSelectPlayer}
      />
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
    <div
      className="space-y-2.5 rounded-lg bg-white/[0.02] p-3"
      onClick={(e) => e.stopPropagation()}
    >
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

function PlayerMatchStatsPanel({
  playerDisplay,
  loading,
  stats,
  labels,
}: {
  playerDisplay: string;
  loading: boolean;
  stats: WcPlayerMatchStats | null | undefined;
  labels: {
    playerStatsTitle: string;
    playerStatsLoading: string;
    playerStatsNone: string;
    playerStatsNotConfigured: string;
    playerMinutes: string;
    playerRating: string;
    playerGoals: string;
    playerAssists: string;
    playerShots: string;
    playerShotsOn: string;
    playerKeyPasses: string;
    playerPassAcc: string;
    playerTackles: string;
    playerYellow: string;
    playerRed: string;
    playerSaves: string;
  };
}) {
  if (loading) {
    return (
      <p className="text-center text-xs text-slate-500">
        {labels.playerStatsLoading}
      </p>
    );
  }

  if (stats === undefined) {
    return (
      <p className="text-center text-xs text-slate-500">
        {labels.playerStatsNotConfigured}
      </p>
    );
  }

  if (!stats) {
    return (
      <p className="text-center text-xs text-slate-500">
        {labels.playerStatsNone}
      </p>
    );
  }

  return (
    <div
      className="rounded-lg border border-brand-accent/20 bg-brand-accent/5 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-brand-accent">
        {labels.playerStatsTitle}: {playerDisplay}
      </p>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        <WcStatChip
          label={labels.playerMinutes}
          value={fmtStat(stats.minutes)}
        />
        <WcStatChip
          label={labels.playerRating}
          value={stats.rating != null ? stats.rating.toFixed(1) : "—"}
          accent
        />
        <WcStatChip label={labels.playerGoals} value={fmtStat(stats.goals)} />
        <WcStatChip
          label={labels.playerAssists}
          value={fmtStat(stats.assists)}
        />
        <WcStatChip
          label={labels.playerShots}
          value={fmtStat(stats.shots_total)}
        />
        <WcStatChip
          label={labels.playerShotsOn}
          value={fmtStat(stats.shots_on)}
        />
        <WcStatChip
          label={labels.playerKeyPasses}
          value={fmtStat(stats.passes_key)}
        />
        <WcStatChip
          label={labels.playerPassAcc}
          value={fmtStat(stats.passes_accuracy, stats.passes_accuracy != null ? "%" : "")}
        />
        <WcStatChip
          label={labels.playerTackles}
          value={fmtStat(stats.tackles)}
        />
        {(stats.yellow_cards ?? 0) > 0 || (stats.red_cards ?? 0) > 0 ? (
          <>
            <WcStatChip
              label={labels.playerYellow}
              value={fmtStat(stats.yellow_cards)}
            />
            <WcStatChip label={labels.playerRed} value={fmtStat(stats.red_cards)} />
          </>
        ) : null}
        {(stats.saves ?? 0) > 0 ? (
          <WcStatChip label={labels.playerSaves} value={fmtStat(stats.saves)} />
        ) : null}
      </div>
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
    collapseHint: string;
    noStats: string;
    statsPending: string;
    xg: string;
    shots: string;
    shotsOn: string;
    possession: string;
    corners: string;
    fouls: string;
    playerStatsTitle: string;
    playerStatsLoading: string;
    playerStatsNone: string;
    playerStatsNotConfigured: string;
    playerMinutes: string;
    playerRating: string;
    playerGoals: string;
    playerAssists: string;
    playerShots: string;
    playerShotsOn: string;
    playerKeyPasses: string;
    playerPassAcc: string;
    playerTackles: string;
    playerYellow: string;
    playerRed: string;
    playerSaves: string;
  };
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedDisplay, setSelectedDisplay] = useState<string>("");
  const [playerStatsLoading, setPlayerStatsLoading] = useState(false);
  const [playerStats, setPlayerStats] = useState<
    WcPlayerMatchStats | null | undefined
  >(undefined);

  const loadPlayerStats = useCallback(
    async (name: string, display: string) => {
      if (selectedPlayer === name && playerStats !== undefined) {
        setSelectedPlayer(null);
        setPlayerStats(undefined);
        return;
      }
      setSelectedPlayer(name);
      setSelectedDisplay(display);
      setPlayerStatsLoading(true);
      setPlayerStats(undefined);
      try {
        const res = await fetch(
          `/api/worldcup/match-player-stats?matchId=${encodeURIComponent(String(match.id))}&player=${encodeURIComponent(name)}`,
        );
        const json = (await res.json()) as {
          stats: WcPlayerMatchStats | null;
          configured: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Failed to load stats");
        setPlayerStats(json.configured ? json.stats : undefined);
      } catch {
        setPlayerStats(null);
      } finally {
        setPlayerStatsLoading(false);
      }
    },
    [match.id, playerStats, selectedPlayer],
  );

  useEffect(() => {
    setSelectedPlayer(null);
    setPlayerStats(undefined);
  }, [match.id]);

  const onSelectPlayer = useCallback(
    (name: string, display: string) => {
      void loadPlayerStats(name, display);
    },
    [loadPlayerStats],
  );

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

  const selectPlayer = (name: string) => {
    const goal = [...homeGoals, ...awayGoals].find(
      (g) => g.scorer === name || g.assist === name,
    );
    const card = [...homeCards, ...awayCards].find((c) => c.player === name);
    const display =
      (goal?.scorer === name
        ? goal.scorer_display
        : goal?.assist_display) ??
      card?.player_display ??
      name;
    onSelectPlayer(name, display);
  };

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
                    selectedPlayer={selectedPlayer}
                    onSelectPlayer={selectPlayer}
                  />
                ) : (
                  <HomeCardRow
                    key={`hc-${i}`}
                    event={ev.c}
                    selectedPlayer={selectedPlayer}
                    onSelectPlayer={selectPlayer}
                  />
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
                    selectedPlayer={selectedPlayer}
                    onSelectPlayer={selectPlayer}
                  />
                ) : (
                  <AwayCardRow
                    key={`ac-${i}`}
                    event={ev.c}
                    selectedPlayer={selectedPlayer}
                    onSelectPlayer={selectPlayer}
                  />
                ),
              )}
            </div>
          </div>
        ) : null}
      </div>

      {selectedPlayer ? (
        <PlayerMatchStatsPanel
          playerDisplay={selectedDisplay}
          loading={playerStatsLoading}
          stats={playerStats}
          labels={labels}
        />
      ) : null}

      {match.stats_available && homeStats && awayStats ? (
        <StatsBlock homeStats={homeStats} awayStats={awayStats} labels={labels} />
      ) : statsLoading ? (
        <p className="text-center text-xs text-slate-500">{labels.statsPending}</p>
      ) : finished ? (
        <p className="text-center text-xs text-slate-500">{labels.noStats}</p>
      ) : null}

      <p className="text-center text-xs text-slate-600">{labels.collapseHint}</p>
    </div>
  );
}
