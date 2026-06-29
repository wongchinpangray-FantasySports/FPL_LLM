"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { WcFlag } from "@/components/worldcup/wc-flag";
import { displayTeamName } from "@/lib/wc/team-names-zh";
import type {
  BracketMatch,
  BracketRound,
  BracketTeam,
  KnockoutBracket,
} from "@/lib/wc/knockout-bracket";

const SLOT_H = 56;

function isLive(status: string): boolean {
  const s = status.toLowerCase();
  return s !== "scheduled" && s !== "complete" && s !== "finished";
}

function isFinished(status: string, homeScore: number | null): boolean {
  const s = status.toLowerCase();
  return s === "complete" || s === "finished" || homeScore != null;
}

function TeamLine({
  side,
  score,
  locale,
  tbd,
  winner,
}: {
  side: BracketTeam | null;
  score: number | null;
  locale: string;
  tbd: string;
  winner: BracketTeam | null;
}) {
  if (!side) {
    return (
      <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-muted-foreground">
        <span className="truncate italic">{tbd}</span>
        <span className="tabular-nums">—</span>
      </div>
    );
  }

  const name = displayTeamName(side.code, side.name, locale);
  const won = winner?.code === side.code;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-2 py-1 text-xs",
        won ? "font-semibold text-brand-accent" : "text-foreground",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        <WcFlag code={side.code} size={14} title={name} />
        <span className="truncate">{name}</span>
      </span>
      <span className="shrink-0 tabular-nums">{score != null ? score : "—"}</span>
    </div>
  );
}

function BracketSlot({
  match,
  locale,
  labels,
}: {
  match: BracketMatch;
  locale: string;
  labels: { tbd: string; live: string; ft: string };
}) {
  const live = isLive(match.status);
  const finished = isFinished(match.status, match.homeScore);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card/90 shadow-sm",
        live && "border-brand-accent/40 ring-1 ring-brand-accent/25",
        finished && match.winner && "border-border",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
        <span>{match.id ? `#${match.id}` : "—"}</span>
        <span
          className={cn(
            live && "font-medium text-brand-accent",
            finished && "text-muted-foreground",
          )}
        >
          {live ? labels.live : finished ? labels.ft : ""}
        </span>
      </div>
      <TeamLine
        side={match.home}
        score={match.homeScore}
        locale={locale}
        tbd={labels.tbd}
        winner={match.winner}
      />
      <TeamLine
        side={match.away}
        score={match.awayScore}
        locale={locale}
        tbd={labels.tbd}
        winner={match.winner}
      />
    </div>
  );
}

function BracketColumn({
  round,
  locale,
  labels,
  span,
}: {
  round: BracketRound;
  locale: string;
  labels: { tbd: string; live: string; ft: string };
  span: number;
}) {
  return (
    <div className="flex w-[11.5rem] shrink-0 flex-col">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-brand-accent">
        {round.label}
      </p>
      <div className="flex flex-col" style={{ gap: span * SLOT_H - SLOT_H }}>
        {round.matches.map((match, idx) => (
          <div
            key={`${round.roundId}-${match.id ?? idx}`}
            style={{ minHeight: span * SLOT_H }}
            className="flex items-center"
          >
            <BracketSlot match={match} locale={locale} labels={labels} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WcKnockoutBracket({
  bracket,
  title,
  summary,
  labels,
}: {
  bracket: KnockoutBracket;
  title: string;
  summary: string;
  labels: { tbd: string; live: string; ft: string };
}) {
  const locale = useLocale();
  const spans = [1, 2, 4, 8, 16];

  return (
    <section className="rounded-xl border border-border bg-card/40 p-4 md:p-5">
      <header className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </header>

      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
        <div
          className="flex min-w-max items-start gap-3 md:gap-4"
          style={{ minHeight: 16 * SLOT_H + 40 }}
        >
          {bracket.rounds.map((round, colIdx) => (
            <BracketColumn
              key={round.roundId}
              round={round}
              locale={locale}
              labels={labels}
              span={spans[colIdx] ?? 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
