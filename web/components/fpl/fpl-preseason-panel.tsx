"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getFplTeamBadgeStyle } from "@/lib/team-themes";
import type { PreseasonClubGroup, PreseasonGoal, PreseasonMatch } from "@/lib/fpl/preseason";
import {
  formatPreseasonDate,
  formatPreseasonKickoffBeijing,
  formatPreseasonScore,
  preseasonOpponentLabel,
  preseasonVenueLabel,
  splitPreseasonMatches,
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
};

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
}: {
  match: PreseasonMatch;
  labels: Pick<Labels, "assist" | "noGoalDetails">;
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
      <GoalGroup title={match.pl_name} goals={plGoals} labels={labels} />
      <GoalGroup title={preseasonOpponentLabel(match)} goals={oppGoals} labels={labels} />
    </div>
  );
}

function GoalGroup({
  title,
  goals,
  labels,
}: {
  title: string;
  goals: PreseasonGoal[];
  labels: Pick<Labels, "assist">;
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
            <span className="font-medium text-foreground">{g.scorer}</span>
            {g.assist ? (
              <span className="text-muted-foreground">
                ({labels.assist}: {g.assist})
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
}: {
  match: PreseasonMatch;
  locale: string;
  labels: Pick<Labels, "vs" | "assist" | "noGoalDetails">;
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
          <GoalLines match={match} labels={labels} />
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
}: {
  match: PreseasonMatch;
  locale: string;
  labels: Pick<Labels, "vs" | "assist" | "noGoalDetails" | "kickoffBeijing" | "kickoffTbd">;
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
      {finished ? <GoalLines match={match} labels={labels} /> : null}
    </div>
  );
}

function ClubSection({
  group,
  locale,
  labels,
  defaultOpen,
}: {
  group: PreseasonClubGroup;
  locale: string;
  labels: Labels;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const badge = getFplTeamBadgeStyle(group.code);
  const finished = group.matches.filter((m) => m.status === "finished").length;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
            <ClubMatchRow key={match.id} match={match} locale={locale} labels={labels} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function FplPreseasonPanel({
  clubs,
  locale,
  source,
  updatedAt,
  labels,
}: {
  clubs: PreseasonClubGroup[];
  locale: string;
  source: string;
  updatedAt: string;
  labels: Labels;
}) {
  const allMatches = useMemo(() => clubs.flatMap((c) => c.matches), [clubs]);
  const { upcoming, results } = useMemo(
    () => splitPreseasonMatches(allMatches),
    [allMatches],
  );

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

      {upcoming.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{labels.upcoming}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.slice(0, 12).map((match) => (
              <UpcomingCard key={match.id} match={match} locale={locale} labels={labels} />
            ))}
          </div>
        </section>
      ) : null}

      {results.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{labels.results}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {results.slice(0, 12).map((match) => (
              <ResultCard key={match.id} match={match} locale={locale} labels={labels} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{labels.allClubs}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{labels.expandClub}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {clubs.map((group, i) => (
            <ClubSection
              key={group.code}
              group={group}
              locale={locale}
              labels={labels}
              defaultOpen={i < 2}
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
