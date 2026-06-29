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

const ROW_H = 22;
const MATCH_H = ROW_H * 2;
const PAIR_INNER_GAP = 4;
const PAIR_SLOT_H = MATCH_H * 2 + PAIR_INNER_GAP;
const BLOCK_GAP = 14;

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

function slotHeight(span: number): number {
  return span * PAIR_SLOT_H + (span - 1) * BLOCK_GAP;
}

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
  tree,
}: {
  side: BracketTeam | null;
  score: number | null;
  locale: string;
  tbd: string;
  winner: BracketTeam | null;
  penalties: boolean;
  tree?: boolean;
}) {
  const rowH = tree ? ROW_H : 28;

  if (!side) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-1.5 border-b border-border/40 bg-muted/15 px-2 last:border-b-0",
          tree ? "px-1.5" : "px-2.5",
        )}
        style={{ height: rowH }}
      >
        <span className="truncate text-[10px] italic text-muted-foreground">{tbd}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">—</span>
      </div>
    );
  }

  const name = displayTeamName(side.code, side.name, locale);
  const won = winner?.code === side.code;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1.5 border-b border-border/40 last:border-b-0",
        won
          ? "border-l-2 border-l-emerald-500 bg-emerald-500/10"
          : "border-l-2 border-l-transparent bg-card/90",
        tree ? "px-1.5" : "px-2.5",
      )}
      style={{ height: rowH }}
      title={name}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <WcFlag code={side.code} size={tree ? 13 : 16} title={name} />
        <span
          className={cn(
            "shrink-0 font-bold tracking-wide text-foreground",
            tree ? "text-[10px]" : "text-xs",
          )}
        >
          {side.code}
        </span>
        {!tree ? (
          <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
            {name}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "shrink-0 font-semibold tabular-nums",
          tree ? "w-3.5 text-right text-[10px]" : "text-xs",
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
  tree,
}: {
  match: BracketMatch;
  locale: string;
  labels: Labels;
  tree?: boolean;
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
        "overflow-hidden rounded border bg-card/95",
        live
          ? "border-brand-accent/50 ring-1 ring-brand-accent/25"
          : "border-border/70",
        tree ? "w-[5.75rem] shrink-0" : "w-full max-w-[14rem]",
      )}
    >
      {!tree && match.id ? (
        <div className="flex items-center justify-between border-b border-border/40 bg-muted/25 px-2 py-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.match.replace("{n}", String(match.id))}
          </span>
          {live || finished ? (
            <span
              className={cn(
                "text-[9px] font-semibold uppercase",
                live ? "text-brand-accent" : "text-muted-foreground",
              )}
            >
              {live ? labels.live : labels.ft}
            </span>
          ) : null}
        </div>
      ) : null}
      <TeamRow
        side={match.home}
        score={match.homeScore}
        locale={locale}
        tbd={labels.tbd}
        winner={match.winner}
        penalties={pens}
        tree={tree}
      />
      <TeamRow
        side={match.away}
        score={match.awayScore}
        locale={locale}
        tbd={labels.tbd}
        winner={match.winner}
        penalties={pens}
        tree={tree}
      />
      {pens && finished ? (
        <p className="border-t border-border/40 bg-muted/25 px-1.5 py-px text-center text-[8px] tabular-nums text-muted-foreground">
          {match.homePenalty}-{match.awayPenalty}p
        </p>
      ) : null}
    </div>
  );
}

function RoundHeader({ label }: { label: string }) {
  return (
    <p className="mb-2.5 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {label}
    </p>
  );
}

function AlignedRound({
  matches,
  span,
  roundLabel,
  locale,
  labels,
  align,
  pairMatches,
}: {
  matches: BracketMatch[];
  span: number;
  roundLabel: string;
  locale: string;
  labels: Labels;
  align: "left" | "right";
  pairMatches?: boolean;
}) {
  const slotH = slotHeight(span);

  if (pairMatches) {
    const pairs: BracketMatch[][] = [];
    for (let i = 0; i < matches.length; i += 2) {
      pairs.push(matches.slice(i, i + 2));
    }

    return (
      <div className="flex shrink-0 flex-col">
        <RoundHeader label={roundLabel} />
        <div className="flex flex-col" style={{ gap: BLOCK_GAP }}>
          {pairs.map((pair, idx) => (
            <div
              key={`${roundLabel}-pair-${idx}`}
              className={cn(
                "relative flex flex-col",
                align === "left" ? "items-end" : "items-start",
              )}
              style={{ minHeight: PAIR_SLOT_H, gap: PAIR_INNER_GAP }}
            >
              {pair.map((match, j) => (
                <MatchCard
                  key={`${match.id ?? j}-${roundLabel}`}
                  match={match}
                  locale={locale}
                  labels={labels}
                  tree
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col">
      <RoundHeader label={roundLabel} />
      <div className="relative flex flex-col" style={{ gap: BLOCK_GAP }}>
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
                  "pointer-events-none absolute top-1/2 z-0 h-px w-2.5 bg-border/80",
                  align === "left" ? "-right-2.5" : "-left-2.5",
                )}
                aria-hidden
              />
            ) : null}
            {span > 1 && idx % 2 === 0 ? (
              <div
                className={cn(
                  "pointer-events-none absolute z-0 w-px bg-border/80",
                  align === "left" ? "-right-2.5" : "-left-2.5",
                )}
                style={{ top: "50%", height: slotH }}
                aria-hidden
              />
            ) : null}
            <MatchCard match={match} locale={locale} labels={labels} tree />
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
  const treeHeight = slotHeight(4);

  const cols =
    align === "left"
      ? [
          { matches: tree.r32, span: 1, label: labels.r32, pair: true },
          { matches: tree.r16, span: 1, label: labels.r16, pair: false },
          { matches: tree.qf, span: 2, label: labels.qf, pair: false },
        ]
      : [
          { matches: tree.qf, span: 2, label: labels.qf, pair: false },
          { matches: tree.r16, span: 1, label: labels.r16, pair: false },
          { matches: tree.r32, span: 1, label: labels.r32, pair: true },
        ];

  const sfCol = (
    <div className="flex shrink-0 flex-col">
      <RoundHeader label={labels.sf} />
      <div className="flex items-center" style={{ minHeight: treeHeight }}>
        {tree.sf ? (
          <MatchCard match={tree.sf} locale={locale} labels={labels} tree />
        ) : (
          <div
            className="flex w-[5.75rem] items-center justify-center rounded border border-dashed border-border/50 bg-muted/10 text-[10px] text-muted-foreground"
            style={{ height: PAIR_SLOT_H }}
          >
            {labels.tbd}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex items-start gap-3">
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
              pairMatches={c.pair}
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
              pairMatches={c.pair}
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
  const treeHeight = slotHeight(4);

  return (
    <div className="flex shrink-0 flex-col items-center px-3">
      <RoundHeader label={labels.final} />
      <div
        className="flex flex-col items-center justify-center gap-2"
        style={{ minHeight: treeHeight }}
      >
        <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-amber-200/90">
          🏆
        </div>
        {match ? (
          <MatchCard match={match} locale={locale} labels={labels} tree />
        ) : (
          <div
            className="flex w-[5.75rem] items-center justify-center rounded border border-dashed border-border/50 bg-muted/10 text-[10px] text-muted-foreground"
            style={{ height: MATCH_H }}
          >
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
          <div className="grid gap-2.5 sm:grid-cols-2">
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
        <div className="mx-auto flex w-max items-start justify-center">
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
