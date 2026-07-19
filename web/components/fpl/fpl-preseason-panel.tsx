"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getFplTeamBadgeStyle } from "@/lib/team-themes";
import type { PreseasonClubGroup, PreseasonMatch } from "@/lib/fpl/preseason";
import {
  formatPreseasonDate,
  formatPreseasonScore,
  preseasonOpponentLabel,
  splitPreseasonMatches,
} from "@/lib/fpl/preseason";

type Labels = {
  upcoming: string;
  results: string;
  allClubs: string;
  home: string;
  away: string;
  vs: string;
  noMatches: string;
  sourceNote: string;
  expandClub: string;
};

function MatchRow({
  match,
  locale,
  labels,
}: {
  match: PreseasonMatch;
  locale: string;
  labels: Pick<Labels, "home" | "away" | "vs">;
}) {
  const badge = getFplTeamBadgeStyle(match.pl_code);
  const score = formatPreseasonScore(match);
  const finished = match.status === "finished";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-3 py-2.5 text-sm last:border-b-0">
      <time
        className="w-24 shrink-0 text-xs text-muted-foreground"
        dateTime={match.date}
      >
        {formatPreseasonDate(match.date, locale)}
      </time>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="rounded-md px-1.5 py-0.5 text-[11px] font-bold"
          style={{ background: badge.chipBg, color: badge.color }}
        >
          {match.pl_code}
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
            match.pl_home
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-sky-500/20 text-sky-300",
          )}
        >
          {match.pl_home ? labels.home : labels.away}
        </span>
        <span className="text-muted-foreground">{labels.vs}</span>
        <span className="min-w-0 truncate font-medium text-foreground">
          {preseasonOpponentLabel(match)}
        </span>
      </div>
      <div className="shrink-0 tabular-nums">
        {finished && score ? (
          <span className="font-semibold text-brand-accent">{score}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      {match.note ? (
        <span className="w-full text-[11px] text-muted-foreground sm:w-auto sm:text-right">
          {match.note}
        </span>
      ) : null}
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
            className="rounded-md px-2 py-1 text-xs font-bold"
            style={{ background: badge.chipBg, color: badge.color }}
          >
            {group.code}
          </span>
          <span className="font-semibold text-foreground">{group.name}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {group.matches.length} · {finished} {labels.results.toLowerCase()}
        </span>
      </button>
      {open ? (
        <div className="border-t border-border/60 bg-background/30">
          {group.matches.map((match) => (
            <MatchRow key={match.id} match={match} locale={locale} labels={labels} />
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
  const allMatches = useMemo(
    () => clubs.flatMap((c) => c.matches),
    [clubs],
  );
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
      {upcoming.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{labels.upcoming}</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card/50">
            {upcoming.slice(0, 12).map((match) => (
              <MatchRow key={match.id} match={match} locale={locale} labels={labels} />
            ))}
          </div>
        </section>
      ) : null}

      {results.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{labels.results}</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card/50">
            {results.slice(0, 12).map((match) => (
              <MatchRow key={match.id} match={match} locale={locale} labels={labels} />
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
