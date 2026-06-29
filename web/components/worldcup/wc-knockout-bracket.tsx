"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { WcFlag } from "@/components/worldcup/wc-flag";
import { displayTeamName } from "@/lib/wc/team-names-zh";
import {
  splitKnockoutBracket,
  type BracketMatch,
  type BracketTeam,
  type KnockoutBracket,
} from "@/lib/wc/knockout-bracket";

/** Height of one two-team match card (px). */
const MATCH_H = 58;
const SLOT_GAP = 10;

type Labels = {
  tbd: string;
  live: string;
  ft: string;
  match: string;
  r32: string;
  r16: string;
  qf: string;
  sf: string;
  final: string;
  fifaLink: string;
};

function isLive(status: string): boolean {
  const s = status.toLowerCase();
  return s !== "scheduled" && s !== "complete" && s !== "finished";
}

function isFinished(status: string, homeScore: number | null): boolean {
  const s = status.toLowerCase();
  return s === "complete" || s === "finished" || homeScore != null;
}

function TeamRow({
  side,
  score,
  locale,
  tbd,
  winner,
  penalties,
}: {
  side: BracketTeam | null;
  score: number | null;
  locale: string;
  tbd: string;
  winner: BracketTeam | null;
  penalties: boolean;
}) {
  if (!side) {
    return (
      <div className="flex h-[29px] items-center justify-between gap-2 border-b border-border/50 bg-muted/20 px-2.5 last:border-b-0">
        <span className="truncate text-[11px] italic text-muted-foreground">{tbd}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">—</span>
      </div>
    );
  }

  const name = displayTeamName(side.code, side.name, locale);
  const won = winner?.code === side.code;

  return (
    <div
      className={cn(
        "flex h-[29px] items-center justify-between gap-2 border-b border-border/50 px-2.5 last:border-b-0",
        won
          ? "border-l-[3px] border-l-emerald-500 bg-emerald-500/10"
          : "border-l-[3px] border-l-transparent bg-card",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <WcFlag code={side.code} size={16} title={name} />
        <span className="shrink-0 text-[11px] font-bold tracking-wide text-foreground">
          {side.code}
        </span>
        <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
          {name}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-xs font-semibold tabular-nums",
          won ? "text-emerald-400" : "text-foreground",
        )}
      >
        {score != null ? score : penalties ? "" : "—"}
      </span>
    </div>
  );
}

function MatchCard({
  match,
  locale,
  labels,
  compact,
}: {
  match: BracketMatch;
  locale: string;
  labels: Labels;
  compact?: boolean;
}) {
  const live = isLive(match.status);
  const finished = isFinished(match.status, match.homeScore);
  const pens =
    match.homePenalty != null &&
    match.awayPenalty != null &&
    match.homePenalty !== match.awayPenalty;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md border shadow-sm",
        live
          ? "border-brand-accent/50 ring-1 ring-brand-accent/30"
          : "border-border/80",
        compact ? "max-w-[9.5rem]" : "max-w-[11rem]",
      )}
    >
      {!compact && match.id ? (
        <div className="absolute -top-2 left-2 z-10 rounded bg-muted px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {labels.match.replace("{n}", String(match.id))}
        </div>
      ) : null}
      {live || finished ? (
        <div
          className={cn(
            "absolute right-1.5 top-1 z-10 rounded px-1 py-px text-[9px] font-semibold uppercase",
            live
              ? "bg-brand-accent/20 text-brand-accent"
              : "bg-muted text-muted-foreground",
          )}
        >
          {live ? labels.live : labels.ft}
        </div>
      ) : null}
      <TeamRow
        side={match.home}
        score={match.homeScore}
        locale={locale}
        tbd={labels.tbd}
        winner={match.winner}
        penalties={pens}
      />
      <TeamRow
        side={match.away}
        score={match.awayScore}
        locale={locale}
        tbd={labels.tbd}
        winner={match.winner}
        penalties={pens}
      />
      {pens && finished ? (
        <p className="border-t border-border/40 bg-muted/30 px-2 py-0.5 text-center text-[9px] tabular-nums text-muted-foreground">
          {match.homePenalty}-{match.awayPenalty} pens
        </p>
      ) : null}
    </div>
  );
}

function RoundHeader({ label }: { label: string }) {
  return (
    <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {label}
    </p>
  );
}

/** One knockout column with vertical spacing so slots align across rounds. */
function AlignedRound({
  matches,
  span,
  roundLabel,
  locale,
  labels,
  align,
}: {
  matches: BracketMatch[];
  span: number;
  roundLabel: string;
  locale: string;
  labels: Labels;
  align: "left" | "right";
}) {
  const slotH = span * MATCH_H + (span - 1) * SLOT_GAP;

  return (
    <div className="flex shrink-0 flex-col">
      <RoundHeader label={roundLabel} />
      <div
        className="relative flex flex-col"
        style={{ gap: slotH - MATCH_H }}
      >
        {matches.map((match, idx) => (
          <div
            key={`${match.id ?? idx}-${roundLabel}`}
            className={cn(
              "relative flex items-center",
              align === "left" ? "justify-end" : "justify-start",
            )}
            style={{ minHeight: slotH }}
          >
            {span > 1 && idx % 2 === 0 ? (
              <div
                className={cn(
                  "pointer-events-none absolute top-1/2 z-0 h-px w-3 bg-border",
                  align === "left" ? "-right-3" : "-left-3",
                )}
                aria-hidden
              />
            ) : null}
            {span > 1 && idx % 2 === 0 ? (
              <div
                className={cn(
                  "pointer-events-none absolute z-0 w-px bg-border",
                  align === "left" ? "-right-3" : "-left-3",
                )}
                style={{
                  top: "50%",
                  height: slotH,
                }}
                aria-hidden
              />
            ) : null}
            <MatchCard match={match} locale={locale} labels={labels} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SideTree({
  tree,
  locale,
  labels,
  align,
}: {
  tree: ReturnType<typeof splitKnockoutBracket>["left"];
  locale: string;
  labels: Labels;
  align: "left" | "right";
}) {
  const cols =
    align === "left"
      ? [
          { matches: tree.r32, span: 1, label: labels.r32 },
          { matches: tree.r16, span: 2, label: labels.r16 },
          { matches: tree.qf, span: 4, label: labels.qf },
        ]
      : [
          { matches: tree.qf, span: 4, label: labels.qf },
          { matches: tree.r16, span: 2, label: labels.r16 },
          { matches: tree.r32, span: 1, label: labels.r32 },
        ];

  const sfCol = (
    <div className="flex shrink-0 flex-col">
      <RoundHeader label={labels.sf} />
      <div
        className="flex items-center"
        style={{ minHeight: 8 * MATCH_H + 7 * SLOT_GAP }}
      >
        {tree.sf ? (
          <MatchCard match={tree.sf} locale={locale} labels={labels} />
        ) : (
          <div className="w-[11rem] rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-6 text-center text-[11px] text-muted-foreground">
            {labels.tbd}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex items-start gap-2 md:gap-3",
        align === "left" ? "flex-row" : "flex-row",
      )}
    >
      {align === "left" ? (
        <>
          {cols.map((c) => (
            <AlignedRound
              key={c.label}
              matches={c.matches}
              span={c.span}
              roundLabel={c.label}
              locale={locale}
              labels={labels}
              align={align}
            />
          ))}
          {sfCol}
        </>
      ) : (
        <>
          {sfCol}
          {cols.map((c) => (
            <AlignedRound
              key={c.label}
              matches={c.matches}
              span={c.span}
              roundLabel={c.label}
              locale={locale}
              labels={labels}
              align={align}
            />
          ))}
        </>
      )}
    </div>
  );
}

function FinalColumn({
  match,
  locale,
  labels,
}: {
  match: BracketMatch | null;
  locale: string;
  labels: Labels;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center px-2 md:px-4">
      <RoundHeader label={labels.final} />
      <div
        className="flex flex-col items-center justify-center gap-2"
        style={{ minHeight: 8 * MATCH_H + 7 * SLOT_GAP }}
      >
        <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">
          🏆
        </div>
        {match ? (
          <MatchCard match={match} locale={locale} labels={labels} compact />
        ) : (
          <div className="w-[9.5rem] rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-8 text-center text-[11px] text-muted-foreground">
            {labels.tbd}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileRoundList({
  bracket,
  locale,
  labels,
}: {
  bracket: KnockoutBracket;
  locale: string;
  labels: Labels;
}) {
  return (
    <div className="flex flex-col gap-6 lg:hidden">
      {bracket.rounds.map((round) => (
        <div key={round.roundId}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-accent">
            {round.label}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {round.matches.map((match, idx) => (
              <MatchCard
                key={`${round.roundId}-${match.id ?? idx}`}
                match={match}
                locale={locale}
                labels={labels}
              />
            ))}
          </div>
        </div>
      ))}
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
  labels: Labels;
}) {
  const locale = useLocale();
  const split = splitKnockoutBracket(bracket);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-card/80 to-card/40 shadow-sm">
      <header className="border-b border-border/60 bg-muted/20 px-4 py-4 md:px-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{summary}</p>
        <a
          href="https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/standings"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-brand-accent hover:underline"
        >
          {labels.fifaLink}
        </a>
      </header>

      <div className="hidden overflow-x-auto p-4 md:p-6 lg:block">
        <div className="mx-auto flex min-w-[960px] max-w-[1200px] items-start justify-center gap-0">
          <SideTree tree={split.left} locale={locale} labels={labels} align="left" />
          <FinalColumn match={split.final} locale={locale} labels={labels} />
          <SideTree tree={split.right} locale={locale} labels={labels} align="right" />
        </div>
      </div>

      <div className="p-4 md:p-6 lg:hidden">
        <MobileRoundList bracket={bracket} locale={locale} labels={labels} />
      </div>
    </section>
  );
}
