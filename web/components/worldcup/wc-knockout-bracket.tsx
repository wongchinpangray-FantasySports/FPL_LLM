"use client";

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

const ROW_H = 24;
const MATCH_H = ROW_H * 2;
const PAIR_INNER_GAP = 4;
const PAIR_SLOT_H = MATCH_H * 2 + PAIR_INNER_GAP;
const BLOCK_GAP = 12;

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
  xhsLink?: string;
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

function useChineseLayout(locale: string): boolean {
  return locale.toLowerCase().startsWith("zh");
}

function TeamRow({
  side,
  score,
  locale,
  tbd,
  winner,
  tree,
  compact,
}: {
  side: BracketTeam | null;
  score: number | null;
  locale: string;
  tbd: string;
  winner: BracketTeam | null;
  tree?: boolean;
  compact?: boolean;
}) {
  const zh = useChineseLayout(locale);
  const rowH = tree ? (zh ? ROW_H + 2 : ROW_H) : 28;

  if (!side) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-1 border-b border-border/40 bg-muted/15 last:border-b-0",
          tree ? "px-1.5" : "px-2.5",
        )}
        style={{ height: rowH }}
      >
        <span
          className={cn(
            "truncate italic text-muted-foreground",
            tree ? "text-[10px]" : "text-xs",
          )}
        >
          {tbd}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">—</span>
      </div>
    );
  }

  const name = displayTeamName(side.code, side.name, locale);
  const won = winner?.code === side.code;
  const showName = zh || !tree;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1 border-b border-border/40 last:border-b-0",
        won
          ? "border-l-2 border-l-emerald-500 bg-emerald-500/10"
          : "border-l-2 border-l-transparent bg-card/90",
        tree ? "px-1.5" : "px-2.5",
      )}
      style={{ height: rowH }}
      title={name}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <WcFlag code={side.code} size={tree ? (zh ? 14 : 13) : 16} title={name} />
        {showName ? (
          <span
            className={cn(
              "truncate font-medium text-foreground",
              tree ? (zh ? "text-[10px]" : "text-[10px] font-bold tracking-wide") : "text-xs",
              !tree && zh ? "sm:text-sm" : "",
            )}
          >
            {zh ? name : side.code}
          </span>
        ) : (
          <span className="shrink-0 text-[10px] font-bold tracking-wide text-foreground">
            {side.code}
          </span>
        )}
        {!tree && !zh ? (
          <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
            {name}
          </span>
        ) : null}
      </span>
      {!compact ? (
        <span
          className={cn(
            "shrink-0 font-semibold tabular-nums",
            tree ? "w-4 text-right text-[10px]" : "text-xs",
            won ? "text-emerald-400" : "text-foreground",
          )}
        >
          {score != null ? score : "—"}
        </span>
      ) : null}
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
  const zh = useChineseLayout(locale);
  const live = isLive(match.status);
  const finished = isFinished(match.status, match.homeScore);
  const pens = hasPenaltyShootout(match);
  const penaltyLine = formatPenaltyLine(match);
  const kickoff = formatBracketKickoff(match.kickoff, locale);
  const hasTeams = Boolean(match.home && match.away);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-card/95 shadow-sm",
        live
          ? "border-brand-accent/50 ring-1 ring-brand-accent/25"
          : "border-border/70",
        tree
          ? zh
            ? "w-[8.25rem] shrink-0 sm:w-[8.75rem]"
            : "w-[6.25rem] shrink-0 sm:w-[6.75rem]"
          : "w-full max-w-[16rem]",
      )}
    >
      {tree && match.id ? (
        <div className="space-y-px border-b border-border/40 bg-muted/20 px-1 py-0.5 text-center">
          <p className="text-[7px] font-medium tabular-nums text-muted-foreground">
            {labels.match.replace("{n}", String(match.id))}
          </p>
          {kickoff && hasTeams ? (
            <p className="text-[7px] leading-tight text-muted-foreground/90">
              {zh ? (
                <>
                  <span>{kickoff.date}</span>{" "}
                  <span className="font-medium text-foreground/80">{kickoff.time}</span>
                </>
              ) : (
                <>
                  {kickoff.date} {kickoff.time}
                </>
              )}
            </p>
          ) : null}
        </div>
      ) : null}
      {!tree && match.id ? (
        <div className="flex items-center justify-between border-b border-border/40 bg-muted/25 px-2 py-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.match.replace("{n}", String(match.id))}
          </span>
          {kickoff && hasTeams ? (
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {kickoff.date} {kickoff.time}
            </span>
          ) : null}
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
        tree={tree}
        compact={Boolean(pens && finished && penaltyLine)}
      />
      <TeamRow
        side={match.away}
        score={match.awayScore}
        locale={locale}
        tbd={labels.tbd}
        winner={match.winner}
        tree={tree}
        compact={Boolean(pens && finished && penaltyLine)}
      />
      {pens && finished && penaltyLine ? (
        <p className="border-t border-border/40 bg-muted/25 px-1 py-0.5 text-center text-[8px] font-medium tabular-nums text-muted-foreground">
          {penaltyLine}
        </p>
      ) : null}
      {!tree && live ? (
        <p className="border-t border-border/40 bg-brand-accent/10 px-2 py-0.5 text-center text-[9px] font-semibold text-brand-accent">
          {labels.live}
        </p>
      ) : null}
    </div>
  );
}

function RoundHeader({ label }: { label: string }) {
  return (
    <p className="mb-2 text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:text-[10px]">
      {label}
    </p>
  );
}

function TbdCard({ label, tree, zh }: { label: string; tree?: boolean; zh?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/10 text-muted-foreground",
        tree ? (zh ? "w-[8.25rem] sm:w-[8.75rem]" : "w-[6.25rem] sm:w-[6.75rem]") : "w-full",
      )}
      style={{ height: tree ? PAIR_SLOT_H / 2 : MATCH_H }}
    >
      <span className="text-[10px]">{label}</span>
    </div>
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
  const zh = useChineseLayout(locale);
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
            {match.home || match.away ? (
              <MatchCard match={match} locale={locale} labels={labels} tree />
            ) : (
              <TbdCard label={labels.tbd} tree zh={zh} />
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
  const zh = useChineseLayout(locale);
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
        {tree.sf?.home && tree.sf?.away ? (
          <MatchCard match={tree.sf} locale={locale} labels={labels} tree />
        ) : (
          <TbdCard label={labels.tbd} tree zh={zh} />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex items-start gap-2 sm:gap-3">
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
  const zh = useChineseLayout(locale);
  const treeHeight = slotHeight(4);

  return (
    <div className="flex shrink-0 flex-col items-center px-2 sm:px-3">
      <RoundHeader label={labels.final} />
      <div
        className="flex flex-col items-center justify-center gap-2"
        style={{ minHeight: treeHeight }}
      >
        <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-200/90">
          🏆
        </div>
        {match?.home && match?.away ? (
          <MatchCard match={match} locale={locale} labels={labels} tree />
        ) : (
          <TbdCard label={labels.tbd} tree zh={zh} />
        )}
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
  labels: Labels;
}) {
  const locale = useLocale();
  const split = splitKnockoutBracket(bracket);
  const zh = useChineseLayout(locale);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-card/80 to-card/40 shadow-sm">
      <header className="border-b border-border/60 bg-muted/20 px-4 py-4 md:px-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{summary}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <a
            href="https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/standings"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-accent hover:underline"
          >
            {labels.fifaLink}
          </a>
          {labels.xhsLink ? (
            <a
              href="https://www.xiaohongshu.com/worldcup26/fixtures"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-accent hover:underline"
            >
              {labels.xhsLink}
            </a>
          ) : null}
        </div>
      </header>

      <div className="overflow-x-auto p-3 sm:p-4 md:p-6">
        <p className="mb-3 text-center text-[10px] text-muted-foreground sm:hidden">
          {zh ? "左右滑动查看完整晋级图" : "Swipe horizontally for the full bracket"}
        </p>
        <div className="mx-auto flex w-max items-start justify-center pb-1">
          <SideTree tree={split.left} locale={locale} labels={labels} align="left" />
          <FinalColumn match={split.final} locale={locale} labels={labels} />
          <SideTree tree={split.right} locale={locale} labels={labels} align="right" />
        </div>
      </div>
    </section>
  );
}
