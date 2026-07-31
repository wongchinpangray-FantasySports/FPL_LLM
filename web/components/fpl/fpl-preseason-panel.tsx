"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getFplTeamBadgeStyle } from "@/lib/team-themes";
import type {
  PreseasonClubGroup,
  PreseasonClubSummary,
  PreseasonGoal,
  PreseasonMatch,
} from "@/lib/fpl/preseason";
import {
  formatPreseasonDate,
  formatPreseasonKickoffBeijing,
  formatPreseasonScore,
  preseasonOpponentLabel,
  preseasonVenueLabel,
  splitPreseasonMatches,
  buildPreseasonLeaderboards,
  type PreseasonLeaderboardRow,
} from "@/lib/fpl/preseason";

type Labels = {
  upcoming: string;
  results: string;
  allClubs: string;
  vs: string;
  noMatches: string;
  sourceNote: string;
  expandClub: string;
  tickerUpcoming: string;
  tickerResult: string;
  kickoffBeijing: string;
  kickoffTbd: string;
  assist: string;
  noGoalDetails: string;
  scorersTitle: string;
  assistsTitle: string;
  leaderboardPlayer: string;
  leaderboardClub: string;
  leaderboardEmpty: string;
  clubSummaryTitle: string;
  lastResult: string;
  expandAll: string;
  collapseAll: string;
  filterAll: string;
  filterResults: string;
  filterUpcoming: string;
  filterClub: string;
};

function playerLinkKey(plCode: string, name: string): string {
  return `${plCode}:${name.trim()}`;
}

function ScorerName({
  name,
  plCode,
  playerLinks,
}: {
  name: string;
  plCode: string;
  playerLinks: Record<string, number>;
}) {
  const fplId = playerLinks[playerLinkKey(plCode, name)];
  if (!fplId) {
    return <span className="font-medium text-foreground">{name}</span>;
  }
  return (
    <Link
      href={`/player/${fplId}`}
      className="font-medium text-foreground hover:text-brand-accent hover:underline"
    >
      {name}
    </Link>
  );
}

function ClubStripe({ code, className }: { code: string; className?: string }) {
  const badge = getFplTeamBadgeStyle(code);
  return (
    <span
      className={cn("w-1 shrink-0 rounded-full", className)}
      style={{ background: badge.bg }}
      aria-hidden
    />
  );
}

function ClubTag({ code }: { code: string }) {
  const badge = getFplTeamBadgeStyle(code);
  return (
    <span
      className="inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums shadow-sm"
      style={{
        background: badge.chipBg,
        color: badge.color,
        boxShadow: `inset 0 0 0 1px ${badge.chipBorder}`,
      }}
    >
      {code}
    </span>
  );
}

function HaLabel({ plHome }: { plHome: boolean }) {
  return (
    <span className="w-4 shrink-0 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {plHome ? "H" : "A"}
    </span>
  );
}

function GoalLines({
  match,
  labels,
  playerLinks,
}: {
  match: PreseasonMatch;
  labels: Pick<Labels, "assist" | "noGoalDetails">;
  playerLinks: Record<string, number>;
}) {
  const { goals } = match;
  if (!goals.length) {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground/80">{labels.noGoalDetails}</p>
    );
  }

  const plGoals = goals.filter((g) => g.side === "pl");
  const oppGoals = goals.filter((g) => g.side === "opp");

  return (
    <div className="mt-2.5 space-y-2 border-t border-border/50 pt-2.5">
      <GoalGroup
        title={match.pl_name}
        goals={plGoals}
        labels={labels}
        plCode={match.pl_code}
        playerLinks={playerLinks}
      />
      <GoalGroup title={preseasonOpponentLabel(match)} goals={oppGoals} labels={labels} />
    </div>
  );
}

function GoalGroup({
  title,
  goals,
  labels,
  plCode,
  playerLinks,
}: {
  title: string;
  goals: PreseasonGoal[];
  labels: Pick<Labels, "assist">;
  plCode?: string;
  playerLinks?: Record<string, number>;
}) {
  if (goals.length === 0) return null;

  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-0.5">
        {goals.map((g, i) => (
          <li key={`${g.minute}-${g.scorer}-${i}`} className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
            {g.minute ? (
              <span className="w-8 shrink-0 tabular-nums text-muted-foreground">{g.minute}</span>
            ) : null}
            {plCode && playerLinks ? (
              <ScorerName name={g.scorer} plCode={plCode} playerLinks={playerLinks} />
            ) : (
              <span className="font-medium text-foreground">{g.scorer}</span>
            )}
            {g.assist ? (
              <span className="text-muted-foreground">
                ({labels.assist}:{" "}
                {plCode && playerLinks ? (
                  <ScorerName name={g.assist} plCode={plCode} playerLinks={playerLinks} />
                ) : (
                  g.assist
                )}
                )
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpcomingCard({
  match,
  locale,
  labels,
}: {
  match: PreseasonMatch;
  locale: string;
  labels: Pick<Labels, "vs" | "kickoffBeijing" | "kickoffTbd">;
}) {
  const kickoff = formatPreseasonKickoffBeijing(match.kickoff_time);
  const venue = preseasonVenueLabel(match);

  return (
    <article
      className="relative flex gap-3 overflow-hidden rounded-xl border border-border bg-card/60 p-3 transition-colors hover:border-border/80 hover:bg-card/80"
      style={{ backgroundImage: `linear-gradient(90deg, ${getFplTeamBadgeStyle(match.pl_code).rowTint} 0%, transparent 42%)` }}
    >
      <ClubStripe code={match.pl_code} className="self-stretch" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ClubTag code={match.pl_code} />
          <HaLabel plHome={match.pl_home} />
          <span className="text-xs text-muted-foreground">{labels.vs}</span>
          <span className="min-w-0 truncate font-semibold text-foreground">
            {preseasonOpponentLabel(match)}
          </span>
        </div>
        {venue ? (
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{venue}</p>
        ) : null}
        {match.note ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{match.note}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <time className="block text-xs font-medium text-foreground" dateTime={match.date}>
          {formatPreseasonDate(match.date, locale)}
        </time>
        <p className="mt-1 text-[11px] text-muted-foreground">{labels.kickoffBeijing}</p>
        <p className="text-sm font-semibold tabular-nums text-brand-accent">
          {kickoff ?? labels.kickoffTbd}
        </p>
      </div>
    </article>
  );
}

function ResultCard({
  match,
  locale,
  labels,
  playerLinks,
}: {
  match: PreseasonMatch;
  locale: string;
  labels: Pick<Labels, "vs" | "assist" | "noGoalDetails">;
  playerLinks: Record<string, number>;
}) {
  const score = formatPreseasonScore(match);
  const venue = preseasonVenueLabel(match);

  return (
    <article
      className="relative overflow-hidden rounded-xl border border-border bg-card/60 p-3"
      style={{ backgroundImage: `linear-gradient(90deg, ${getFplTeamBadgeStyle(match.pl_code).rowTint} 0%, transparent 38%)` }}
    >
      <div className="flex gap-3">
        <ClubStripe code={match.pl_code} className="self-stretch" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ClubTag code={match.pl_code} />
                <HaLabel plHome={match.pl_home} />
                <span className="text-xs text-muted-foreground">{labels.vs}</span>
                <span className="min-w-0 truncate font-semibold text-foreground">
                  {preseasonOpponentLabel(match)}
                </span>
              </div>
              {venue ? (
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{venue}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <time className="block text-xs text-muted-foreground" dateTime={match.date}>
                {formatPreseasonDate(match.date, locale)}
              </time>
              {score ? (
                <p className="mt-0.5 text-lg font-bold tabular-nums text-brand-accent">{score}</p>
              ) : null}
            </div>
          </div>
          <GoalLines match={match} labels={labels} playerLinks={playerLinks} />
        </div>
      </div>
    </article>
  );
}

function PreseasonTicker({
  upcoming,
  results,
  locale,
  labels,
}: {
  upcoming: PreseasonMatch[];
  results: PreseasonMatch[];
  locale: string;
  labels: Pick<Labels, "tickerUpcoming" | "tickerResult" | "vs" | "kickoffTbd">;
}) {
  const items = useMemo(() => {
    const recent = results.slice(0, 8);
    const next = upcoming.slice(0, 10);
    return [
      ...next.map((m) => ({ kind: "upcoming" as const, match: m })),
      ...recent.map((m) => ({ kind: "result" as const, match: m })),
    ];
  }, [upcoming, results]);

  if (items.length === 0) return null;

  const chips = items.map(({ kind, match }) => {
    const score = formatPreseasonScore(match);
    const kickoff = formatPreseasonKickoffBeijing(match.kickoff_time);
    const badge = getFplTeamBadgeStyle(match.pl_code);

    return (
      <div
        key={`${kind}-${match.id}`}
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground/90"
      >
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            kind === "result" ? "text-brand-accent" : "text-sky-400",
          )}
        >
          {kind === "result" ? labels.tickerResult : labels.tickerUpcoming}
        </span>
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-bold shadow-sm"
          style={{
            background: badge.chipBg,
            color: badge.color,
            boxShadow: `inset 0 0 0 1px ${badge.chipBorder}`,
          }}
        >
          {match.pl_code}
        </span>
        <span className="text-[10px] text-muted-foreground">{match.pl_home ? "H" : "A"}</span>
        <span className="text-muted-foreground">{labels.vs}</span>
        <span className="max-w-[7rem] truncate sm:max-w-none">{preseasonOpponentLabel(match)}</span>
        <span className="tabular-nums font-medium text-foreground">
          {kind === "result" && score ? score : "·"}
        </span>
        {kind === "upcoming" ? (
          <span className="text-xs text-muted-foreground">
            {kickoff ?? labels.kickoffTbd}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {formatPreseasonDate(match.date, locale)}
          </span>
        )}
      </div>
    );
  });

  const loop = [...chips, ...chips];

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card/50 py-2.5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
      <div className="overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-3 px-4 animate-[marquee_50s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none">
          {loop.map((chip, i) => (
            <div key={i} className="shrink-0">
              {chip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClubMatchRow({
  match,
  locale,
  labels,
  playerLinks,
}: {
  match: PreseasonMatch;
  locale: string;
  labels: Pick<Labels, "vs" | "assist" | "noGoalDetails" | "kickoffBeijing" | "kickoffTbd">;
  playerLinks: Record<string, number>;
}) {
  const score = formatPreseasonScore(match);
  const finished = match.status === "finished";
  const kickoff = formatPreseasonKickoffBeijing(match.kickoff_time);

  return (
    <div
      className="border-b border-border/60 px-3 py-2.5 last:border-b-0"
      style={{
        background: `linear-gradient(90deg, ${getFplTeamBadgeStyle(match.pl_code).rowTint} 0%, transparent 55%)`,
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <ClubStripe code={match.pl_code} className="h-8" />
        <time className="w-20 shrink-0 text-xs text-muted-foreground" dateTime={match.date}>
          {formatPreseasonDate(match.date, locale)}
        </time>
        <HaLabel plHome={match.pl_home} />
        <span className="text-muted-foreground">{labels.vs}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {preseasonOpponentLabel(match)}
        </span>
        <div className="shrink-0 tabular-nums">
          {finished && score ? (
            <span className="font-semibold text-brand-accent">{score}</span>
          ) : kickoff ? (
            <span className="text-xs text-brand-accent">{kickoff}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{labels.kickoffTbd}</span>
          )}
        </div>
      </div>
      {finished ? (
        <GoalLines match={match} labels={labels} playerLinks={playerLinks} />
      ) : null}
    </div>
  );
}

function ClubSection({
  group,
  locale,
  labels,
  open,
  onToggle,
  playerLinks,
}: {
  group: PreseasonClubGroup;
  locale: string;
  labels: Labels;
  open: boolean;
  onToggle: () => void;
  playerLinks: Record<string, number>;
}) {
  const badge = getFplTeamBadgeStyle(group.code);
  const finished = group.matches.filter((m) => m.status === "finished").length;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="h-6 w-1 shrink-0 rounded-full"
            style={{ background: badge.bg }}
            aria-hidden
          />
          <ClubTag code={group.code} />
          <span className="font-semibold text-foreground">{group.name}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {group.matches.length} · {finished} {labels.results.toLowerCase()}
        </span>
      </button>
      {open ? (
        <div className="border-t border-border/60 bg-background/30">
          {group.matches.map((match) => (
            <ClubMatchRow
              key={match.id}
              match={match}
              locale={locale}
              labels={labels}
              playerLinks={playerLinks}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LeaderboardTable({
  title,
  rows,
  statLabel,
  labels,
  playerLinks,
}: {
  title: string;
  rows: PreseasonLeaderboardRow[];
  statLabel: string;
  labels: Pick<Labels, "leaderboardPlayer" | "leaderboardClub" | "leaderboardEmpty">;
  playerLinks: Record<string, number>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/60">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{labels.leaderboardEmpty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[16rem] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="w-8 px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">{labels.leaderboardPlayer}</th>
                <th className="px-3 py-2 font-semibold">{labels.leaderboardClub}</th>
                <th className="w-12 px-3 py-2 text-right font-semibold">{statLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.key}
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/20"
                >
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    <ScorerName
                      name={row.name}
                      plCode={row.pl_code}
                      playerLinks={playerLinks}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <ClubTag code={row.pl_code} />
                      <span className="hidden text-muted-foreground sm:inline">{row.pl_name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-brand-accent">
                    {row.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PreseasonLeaderboards({
  matches,
  labels,
  playerLinks,
}: {
  matches: PreseasonMatch[];
  labels: Pick<
    Labels,
    | "scorersTitle"
    | "assistsTitle"
    | "leaderboardPlayer"
    | "leaderboardClub"
    | "leaderboardEmpty"
  >;
  playerLinks: Record<string, number>;
}) {
  const { scorers, assists } = useMemo(
    () => buildPreseasonLeaderboards(matches),
    [matches],
  );

  if (scorers.length === 0 && assists.length === 0) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <LeaderboardTable
        title={labels.scorersTitle}
        rows={scorers}
        statLabel="G"
        labels={labels}
        playerLinks={playerLinks}
      />
      <LeaderboardTable
        title={labels.assistsTitle}
        rows={assists}
        statLabel="A"
        labels={labels}
        playerLinks={playerLinks}
      />
    </section>
  );
}

function formatClubRecord(
  s: PreseasonClubSummary,
  locale: string,
): string {
  if (locale.startsWith("zh")) {
    return `${s.won}胜-${s.drawn}平-${s.lost}负`;
  }
  return `${s.won}W-${s.drawn}D-${s.lost}L`;
}

function formatClubGoals(s: PreseasonClubSummary, locale: string): string {
  if (locale.startsWith("zh")) {
    return `进${s.gf} 失${s.ga}`;
  }
  return `${s.gf}–${s.ga} GF/GA`;
}

function ClubSummaryStrip({
  summaries,
  locale,
  labels,
  selectedClub,
  onSelectClub,
}: {
  summaries: PreseasonClubSummary[];
  locale: string;
  labels: Pick<Labels, "clubSummaryTitle" | "lastResult">;
  selectedClub: string;
  onSelectClub: (code: string) => void;
}) {
  if (summaries.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        {labels.clubSummaryTitle}
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onSelectClub("all")}
          className={cn(
            "shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
            selectedClub === "all"
              ? "border-brand-accent/40 bg-brand-accent/10"
              : "border-border bg-card/60 hover:bg-muted/40",
          )}
        >
          <span className="font-semibold text-foreground">ALL</span>
        </button>
        {summaries.map((s) => {
          const badge = getFplTeamBadgeStyle(s.code);
          const lastScore = s.lastMatch ? formatPreseasonScore(s.lastMatch) : null;
          return (
            <button
              key={s.code}
              type="button"
              onClick={() => onSelectClub(s.code)}
              className={cn(
                "min-w-[9.5rem] shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                selectedClub === s.code
                  ? "border-brand-accent/40 bg-brand-accent/10"
                  : "border-border bg-card/60 hover:bg-muted/40",
              )}
              style={{
                backgroundImage: `linear-gradient(135deg, ${badge.rowTint} 0%, transparent 70%)`,
              }}
            >
              <div className="flex items-center gap-2">
                <ClubTag code={s.code} />
                <span className="font-semibold text-foreground">{s.code}</span>
              </div>
              <p className="mt-1 tabular-nums text-muted-foreground">
                {s.played}P · {formatClubRecord(s, locale)}
              </p>
              <p className="tabular-nums text-brand-accent">
                {formatClubGoals(s, locale)}
              </p>
              {s.lastMatch && lastScore ? (
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {labels.lastResult}: {formatPreseasonDate(s.lastMatch.date, locale)} {lastScore}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PreseasonToolbar({
  labels,
  view,
  onViewChange,
  clubFilter,
  onClubFilterChange,
  clubs,
  allExpanded,
  onToggleExpandAll,
}: {
  labels: Pick<
    Labels,
    | "filterAll"
    | "filterResults"
    | "filterUpcoming"
    | "filterClub"
    | "expandAll"
    | "collapseAll"
  >;
  view: "all" | "results" | "upcoming";
  onViewChange: (view: "all" | "results" | "upcoming") => void;
  clubFilter: string;
  onClubFilterChange: (code: string) => void;
  clubs: PreseasonClubGroup[];
  allExpanded: boolean;
  onToggleExpandAll: () => void;
}) {
  const viewBtn = (id: "all" | "results" | "upcoming", label: string) => (
    <button
      type="button"
      onClick={() => onViewChange(id)}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        view === id
          ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
          : "border-border bg-card text-muted-foreground hover:bg-muted/40",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {viewBtn("all", labels.filterAll)}
      {viewBtn("results", labels.filterResults)}
      {viewBtn("upcoming", labels.filterUpcoming)}
      <select
        value={clubFilter}
        onChange={(e) => onClubFilterChange(e.target.value)}
        className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground"
        aria-label={labels.filterClub}
      >
        <option value="all">{labels.filterClub}: ALL</option>
        {clubs.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onToggleExpandAll}
        className="ml-auto rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/40"
      >
        {allExpanded ? labels.collapseAll : labels.expandAll}
      </button>
    </div>
  );
}

export function FplPreseasonPanel({
  clubs,
  summaries,
  locale,
  source,
  updatedAt,
  labels,
  playerLinks,
}: {
  clubs: PreseasonClubGroup[];
  summaries: PreseasonClubSummary[];
  locale: string;
  source: string;
  updatedAt: string;
  labels: Labels;
  playerLinks: Record<string, number>;
}) {
  const allMatches = useMemo(() => clubs.flatMap((c) => c.matches), [clubs]);
  const { upcoming, results } = useMemo(
    () => splitPreseasonMatches(allMatches),
    [allMatches],
  );

  const [view, setView] = useState<"all" | "results" | "upcoming">("all");
  const [clubFilter, setClubFilter] = useState("all");
  const [allExpanded, setAllExpanded] = useState(false);
  const [expandedClubs, setExpandedClubs] = useState<Set<string>>(
    () => new Set(clubs.slice(0, 4).map((c) => c.code)),
  );

  useEffect(() => {
    if (clubFilter !== "all") {
      setExpandedClubs(new Set([clubFilter]));
      setAllExpanded(false);
    }
  }, [clubFilter]);

  const filteredClubs = useMemo(() => {
    if (clubFilter === "all") return clubs;
    return clubs.filter((c) => c.code === clubFilter);
  }, [clubs, clubFilter]);

  const filterMatches = (list: PreseasonMatch[]) => {
    if (clubFilter === "all") return list;
    return list.filter((m) => m.pl_code === clubFilter);
  };

  const visibleUpcoming = filterMatches(upcoming);
  const visibleResults = filterMatches(results);
  const showUpcoming = view === "all" || view === "upcoming";
  const showResults = view === "all" || view === "results";

  const toggleClub = (code: string) => {
    setExpandedClubs((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedClubs(new Set());
      setAllExpanded(false);
    } else {
      setExpandedClubs(new Set(filteredClubs.map((c) => c.code)));
      setAllExpanded(true);
    }
  };

  if (clubs.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card/50 px-4 py-6 text-sm text-muted-foreground">
        {labels.noMatches}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PreseasonTicker
        upcoming={upcoming}
        results={results}
        locale={locale}
        labels={labels}
      />

      <ClubSummaryStrip
        summaries={summaries}
        locale={locale}
        labels={labels}
        selectedClub={clubFilter}
        onSelectClub={setClubFilter}
      />

      <PreseasonLeaderboards matches={allMatches} labels={labels} playerLinks={playerLinks} />

      <PreseasonToolbar
        labels={labels}
        view={view}
        onViewChange={setView}
        clubFilter={clubFilter}
        onClubFilterChange={setClubFilter}
        clubs={clubs}
        allExpanded={allExpanded}
        onToggleExpandAll={toggleExpandAll}
      />

      {showUpcoming && visibleUpcoming.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{labels.upcoming}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleUpcoming.slice(0, 12).map((match) => (
              <UpcomingCard key={match.id} match={match} locale={locale} labels={labels} />
            ))}
          </div>
        </section>
      ) : null}

      {showResults && visibleResults.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{labels.results}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleResults.slice(0, 12).map((match) => (
              <ResultCard
                key={match.id}
                match={match}
                locale={locale}
                labels={labels}
                playerLinks={playerLinks}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{labels.allClubs}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{labels.expandClub}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {filteredClubs.map((group) => (
            <ClubSection
              key={group.code}
              group={group}
              locale={locale}
              labels={labels}
              open={expandedClubs.has(group.code)}
              onToggle={() => toggleClub(group.code)}
              playerLinks={playerLinks}
            />
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        {labels.sourceNote}{" "}
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-accent hover:underline"
        >
          premierleague.com
        </a>
        {" · "}
        {updatedAt}
      </p>
    </div>
  );
}
