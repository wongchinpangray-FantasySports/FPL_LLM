"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { WcFlag } from "@/components/worldcup/wc-flag";
import { displayTeamName } from "@/lib/wc/team-names-zh";
import {
  formatBracketKickoff,
  formatPenaltyLine,
  hasPenaltyShootout,
} from "@/lib/wc/bracket-format";
import {
  splitKnockoutBracket,
  type BracketMatch,
  type BracketTeam,
  type KnockoutBracket,
} from "@/lib/wc/knockout-bracket";

type ViewMode = "tree" | "rounds";

const ROW_H = 26;
const MATCH_H = ROW_H * 2;
const PAIR_GAP = 4;
const PAIR_SLOT_H = MATCH_H * 2 + PAIR_GAP;
const BLOCK_GAP = 12;
const COL_GAP = 14;

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
  bronze: string;
  tabTree: string;
  tabSchedule: string;
  swipeHint: string;
  fifaLink: string;
};

function isZh(locale: string): boolean {
  return locale.toLowerCase().startsWith("zh");
}

function isLive(status: string): boolean {
  const s = status.toLowerCase();
  return s !== "scheduled" && s !== "complete" && s !== "finished";
}

function isFinished(status: string, homeScore: number | null): boolean {
  const s = status.toLowerCase();
  return s === "complete" || s === "finished" || homeScore != null;
}

function slotHeight(span: number): number {
  return span * PAIR_SLOT_H + (span - 1) * BLOCK_GAP;
}

function teamName(
  side: BracketTeam | null,
  locale: string,
  tbd: string,
): string {
  if (!side) return tbd;
  return displayTeamName(side.code, side.name, locale);
}

function roundHasTeams(matches: BracketMatch[]): boolean {
  return matches.some((m) => m.home && m.away);
}

function matchHasTeams(match: BracketMatch | null): boolean {
  return Boolean(match?.home && match?.away);
}

function TeamLine({
  side,
  score,
  locale,
  tbd,
  winner,
  compact,
}: {
  side: BracketTeam | null;
  score: number | null;
  locale: string;
  tbd: string;
  winner: BracketTeam | null;
  compact?: boolean;
}) {
  const zh = isZh(locale);
  const won = Boolean(side && winner?.code === side.code);

  if (!side) {
    return (
      <div
        className="flex items-center justify-between border-b border-border/40 bg-muted/10 px-2 last:border-b-0"
        style={{ height: compact ? ROW_H - 2 : ROW_H }}
      >
        <span className="text-[10px] italic text-muted-foreground">{tbd}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">—</span>
      </div>
    );
  }

  const name = teamName(side, locale, tbd);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1 border-b border-border/40 px-2 last:border-b-0",
        won
          ? "border-l-2 border-l-emerald-500 bg-emerald-500/10"
          : "border-l-2 border-l-transparent",
        compact ? "py-0" : "",
      )}
      style={{ height: compact ? ROW_H - 2 : ROW_H }}
      title={name}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <WcFlag code={side.code} size={compact ? 13 : 15} title={name} />
        <span
          className={cn(
            "truncate font-semibold tracking-wide",
            compact ? "text-[10px]" : "text-[11px]",
            zh ? "font-medium tracking-normal" : "uppercase",
          )}
        >
          {zh ? name : side.code}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums font-semibold",
          compact ? "text-[10px]" : "text-[11px]",
          won ? "text-emerald-400" : "text-foreground",
        )}
      >
        {score != null ? score : "—"}
      </span>
    </div>
  );
}

function MatchCard({
  match,
  locale,
  labels,
  compact,
  showMeta,
  metaLabel,
}: {
  match: BracketMatch;
  locale: string;
  labels: Labels;
  compact?: boolean;
  showMeta?: boolean;
  metaLabel?: string;
}) {
  const live = isLive(match.status);
  const finished = isFinished(match.status, match.homeScore);
  const pens = hasPenaltyShootout(match);
  const penaltyLine = formatPenaltyLine(match);
  const kickoff = formatBracketKickoff(match.kickoff, locale);
  const hasTeams = Boolean(match.home && match.away);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card/95 shadow-sm",
        live
          ? "border-brand-accent/50 ring-1 ring-brand-accent/20"
          : "border-border/70",
        compact ? "w-[6.75rem] shrink-0 sm:w-[7.25rem]" : "w-full",
      )}
    >
      {showMeta && (match.id || kickoff || metaLabel) ? (
        <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-2 py-0.5">
          <span className="text-[9px] font-medium text-muted-foreground">
            {metaLabel ??
              (match.id ? labels.match.replace("{n}", String(match.id)) : "")}
          </span>
          <div className="flex items-center gap-1.5">
            {kickoff && hasTeams ? (
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {kickoff.date} {kickoff.time}
              </span>
            ) : null}
            {live ? (
              <span className="text-[9px] font-semibold text-brand-accent">{labels.live}</span>
            ) : finished ? (
              <span className="text-[9px] text-muted-foreground">{labels.ft}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <TeamLine
        side={match.home}
        score={match.homeScore}
        locale={locale}
        tbd={labels.tbd}
        winner={match.winner}
        compact={compact}
      />
      <TeamLine
        side={match.away}
        score={match.awayScore}
        locale={locale}
        tbd={labels.tbd}
        winner={match.winner}
        compact={compact}
      />

      {pens && finished && penaltyLine ? (
        <p className="border-t border-border/40 bg-muted/20 px-2 py-0.5 text-center text-[9px] tabular-nums text-muted-foreground">
          {penaltyLine}
        </p>
      ) : null}
    </div>
  );
}

function PlaceholderCard({
  label,
  compact,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/10 text-[10px] text-muted-foreground",
        compact ? "h-[3.25rem] w-[6.75rem] sm:w-[7.25rem]" : "h-16 w-full",
      )}
    >
      {label}
    </div>
  );
}

function RoundHeader({ label }: { label: string }) {
  return (
    <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                "flex flex-col",
                align === "left" ? "items-end" : "items-start",
              )}
              style={{ minHeight: PAIR_SLOT_H, gap: PAIR_GAP }}
            >
              {pair.map((match, j) =>
                match.home || match.away ? (
                  <MatchCard
                    key={`${match.id ?? j}-${roundLabel}`}
                    match={match}
                    locale={locale}
                    labels={labels}
                    compact
                  />
                ) : (
                  <PlaceholderCard key={`ph-${j}`} label={labels.tbd} compact />
                ),
              )}
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
              <>
                <div
                  className={cn(
                    "pointer-events-none absolute top-1/2 z-0 h-px w-3 bg-border/70",
                    align === "left" ? "-right-3" : "-left-3",
                  )}
                  aria-hidden
                />
                <div
                  className={cn(
                    "pointer-events-none absolute z-0 w-px bg-border/70",
                    align === "left" ? "-right-3" : "-left-3",
                  )}
                  style={{ top: "50%", height: slotH }}
                  aria-hidden
                />
              </>
            ) : null}
            {match.home || match.away ? (
              <MatchCard match={match} locale={locale} labels={labels} compact />
            ) : (
              <PlaceholderCard label={labels.tbd} compact />
            )}
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
  const showQf = roundHasTeams(tree.qf);
  const showSf = matchHasTeams(tree.sf);

  const cols =
    align === "left"
      ? [
          { matches: tree.r32, span: 1, label: labels.r32, pair: true },
          { matches: tree.r16, span: 1, label: labels.r16, pair: false },
          ...(showQf
            ? [{ matches: tree.qf, span: 2, label: labels.qf, pair: false }]
            : []),
        ]
      : [
          ...(showQf
            ? [{ matches: tree.qf, span: 2, label: labels.qf, pair: false }]
            : []),
          { matches: tree.r16, span: 1, label: labels.r16, pair: false },
          { matches: tree.r32, span: 1, label: labels.r32, pair: true },
        ];

  const sfCol = showSf ? (
    <div className="flex shrink-0 flex-col">
      <RoundHeader label={labels.sf} />
      <div className="flex items-center" style={{ minHeight: treeHeight }}>
        {tree.sf ? (
          <MatchCard match={tree.sf} locale={locale} labels={labels} compact />
        ) : (
          <PlaceholderCard label={labels.tbd} compact />
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex items-start" style={{ gap: COL_GAP }}>
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
  final,
  bronze,
  locale,
  labels,
}: {
  final: BracketMatch | null;
  bronze: BracketMatch | null;
  locale: string;
  labels: Labels;
}) {
  const treeHeight = slotHeight(4);

  return (
    <div className="flex shrink-0 flex-col items-center px-2" style={{ gap: COL_GAP }}>
      <div className="flex flex-col items-center" style={{ minHeight: treeHeight }}>
        <RoundHeader label={labels.final} />
        <div className="mb-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-200/90">
          🏆
        </div>
        {matchHasTeams(final) && final ? (
          <MatchCard match={final} locale={locale} labels={labels} compact />
        ) : (
          <PlaceholderCard label={labels.tbd} compact />
        )}
      </div>
      {matchHasTeams(bronze) && bronze ? (
        <div className="flex flex-col items-center">
          <RoundHeader label={labels.bronze} />
          <MatchCard match={bronze} locale={locale} labels={labels} compact />
        </div>
      ) : null}
    </div>
  );
}

function RoundList({
  bracket,
  locale,
  labels,
}: {
  bracket: KnockoutBracket;
  locale: string;
  labels: Labels;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
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
                showMeta
                metaLabel={
                  match.id === 103
                    ? labels.bronze
                    : match.id
                      ? labels.match.replace("{n}", String(match.id))
                      : round.label
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ViewToggle({
  mode,
  onChange,
  labels,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  labels: Labels;
}) {
  const tabs: { id: ViewMode; label: string }[] = [
    { id: "rounds", label: labels.tabSchedule },
    { id: "tree", label: labels.tabTree },
  ];

  return (
    <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
            mode === tab.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
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
  const [mode, setMode] = useState<ViewMode>("rounds");

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-card/80 to-card/40 shadow-sm">
      <header className="border-b border-border/60 bg-muted/20 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{summary}</p>
          </div>
          <div className="shrink-0 sm:w-52">
            <ViewToggle mode={mode} onChange={setMode} labels={labels} />
          </div>
        </div>
        <a
          href="https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/standings"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs text-brand-accent hover:underline"
        >
          {labels.fifaLink}
        </a>
      </header>

      {mode === "tree" ? (
        <div className="overflow-x-auto p-4 lg:p-6">
          <p className="mb-3 text-center text-xs text-muted-foreground lg:hidden">
            {labels.swipeHint}
          </p>
          <div className="mx-auto flex w-max items-start justify-center pb-1">
            <SideTree tree={split.left} locale={locale} labels={labels} align="left" />
            <FinalColumn
              final={split.final}
              bronze={split.bronze}
              locale={locale}
              labels={labels}
            />
            <SideTree tree={split.right} locale={locale} labels={labels} align="right" />
          </div>
        </div>
      ) : (
        <div className="p-4 lg:p-6">
          <RoundList bracket={bracket} locale={locale} labels={labels} />
        </div>
      )}
    </section>
  );
}
