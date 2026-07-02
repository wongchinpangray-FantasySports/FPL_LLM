"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { WcFlag } from "@/components/worldcup/wc-flag";
import { displayTeamName } from "@/lib/wc/team-names-zh";
import {
  formatBracketKickoff,
  formatXhsScoreCenter,
  hasPenaltyShootout,
} from "@/lib/wc/bracket-format";
import {
  splitKnockoutBracket,
  type BracketMatch,
  type BracketTeam,
  type KnockoutBracket,
} from "@/lib/wc/knockout-bracket";

const SLOT_UNIT = 52;
const PAIR_GAP = 6;
const COL_GAP = 10;
const BLOCK_GAP = 14;

type ViewMode = "tree" | "schedule";

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
  xhsLink?: string;
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

function roundLabelForStage(stage: string, labels: Labels): string {
  switch (stage) {
    case "R32":
      return labels.r32;
    case "R16":
      return labels.r16;
    case "QF":
      return labels.qf;
    case "SF":
      return labels.sf;
    case "F":
      return labels.final;
    default:
      return stage;
  }
}

function slotHeight(span: number): number {
  return span * SLOT_UNIT * 2 + (span - 1) * BLOCK_GAP;
}

function teamLabel(
  side: BracketTeam | null,
  locale: string,
  tbd: string,
): string {
  if (!side) return tbd;
  return displayTeamName(side.code, side.name, locale);
}

function XhsMatchCard({
  match,
  locale,
  labels,
  roundLabel,
  compact,
  tree,
}: {
  match: BracketMatch;
  locale: string;
  labels: Labels;
  roundLabel?: string;
  compact?: boolean;
  tree?: boolean;
}) {
  const zh = isZh(locale);
  const live = isLive(match.status);
  const finished = isFinished(match.status, match.homeScore);
  const kickoff = formatBracketKickoff(match.kickoff, locale);
  const scoreCenter = formatXhsScoreCenter(match);
  const hasTeams = Boolean(match.home && match.away);
  const pens = hasPenaltyShootout(match);

  const homeName = teamLabel(match.home, locale, labels.tbd);
  const awayName = teamLabel(match.away, locale, labels.tbd);
  const homeWon = match.winner?.code === match.home?.code;
  const awayWon = match.winner?.code === match.away?.code;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border shadow-sm transition-colors",
        live
          ? "border-[#ff2442]/40 bg-white ring-1 ring-[#ff2442]/20"
          : "border-black/[0.06] bg-white",
        tree
          ? cn("w-[9.5rem] shrink-0", !zh && "w-[7.75rem]")
          : "w-full",
        compact && tree && (zh ? "w-[9.5rem]" : "w-[7.75rem]"),
      )}
    >
      <div className="flex items-center justify-between gap-1 border-b border-black/[0.05] px-2 py-1">
        <span className="text-[10px] font-medium tabular-nums text-zinc-500">
          {kickoff?.time ?? (hasTeams ? "—" : "")}
        </span>
        <span className="rounded px-1.5 py-px text-[9px] font-medium text-[#ff2442]">
          {roundLabel ?? roundLabelForStage(match.stage, labels)}
        </span>
        {live ? (
          <span className="text-[9px] font-semibold text-[#ff2442]">{labels.live}</span>
        ) : finished ? (
          <span className="text-[9px] text-zinc-400">{labels.ft}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 py-2">
        <div
          className={cn(
            "flex min-w-0 items-center justify-end gap-1",
            homeWon && "font-semibold text-emerald-700",
            !match.home && "text-zinc-400 italic",
          )}
        >
          {match.home ? (
            <>
              <span className="truncate text-[11px] leading-tight">{homeName}</span>
              <WcFlag code={match.home.code} size={14} title={homeName} />
            </>
          ) : (
            <span className="text-[11px]">{labels.tbd}</span>
          )}
        </div>

        <span
          className={cn(
            "px-1 text-center text-[11px] font-bold tabular-nums tracking-tight",
            pens && finished ? "text-[10px]" : "",
            scoreCenter === "---" ? "text-zinc-300" : "text-zinc-800",
          )}
        >
          {scoreCenter}
        </span>

        <div
          className={cn(
            "flex min-w-0 items-center gap-1",
            awayWon && "font-semibold text-emerald-700",
            !match.away && "text-zinc-400 italic",
          )}
        >
          {match.away ? (
            <>
              <WcFlag code={match.away.code} size={14} title={awayName} />
              <span className="truncate text-[11px] leading-tight">{awayName}</span>
            </>
          ) : (
            <span className="text-[11px]">{labels.tbd}</span>
          )}
        </div>
      </div>

      {!tree && kickoff?.date ? (
        <p className="border-t border-black/[0.05] px-2 py-1 text-[10px] text-zinc-400">
          {kickoff.date}
        </p>
      ) : null}
    </div>
  );
}

function TbdTreeCard({ label, locale }: { label: string; locale: string }) {
  const zh = isZh(locale);
  return (
    <div
      className={cn(
        "flex h-[3.25rem] items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-[11px] text-zinc-400",
        zh ? "w-[9.5rem]" : "w-[7.75rem]",
      )}
    >
      {label}
    </div>
  );
}

function RoundTitle({ label }: { label: string }) {
  return (
    <p className="mb-2 text-center text-[10px] font-semibold text-zinc-500">{label}</p>
  );
}

function Connector({
  align,
  span,
}: {
  align: "left" | "right";
  span: number;
}) {
  const h = slotHeight(span);
  return (
    <svg
      className={cn(
        "pointer-events-none absolute top-1/2 z-0 text-zinc-300",
        align === "left" ? "-right-3" : "-left-3",
      )}
      width={12}
      height={h}
      aria-hidden
    >
      <path
        d={
          align === "left"
            ? `M0 ${h / 2} H8 V0 H12 M8 ${h / 2} V${h}`
            : `M12 ${h / 2} H4 V0 H0 M4 ${h / 2} V${h}`
        }
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      />
    </svg>
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
        <RoundTitle label={roundLabel} />
        <div className="flex flex-col" style={{ gap: BLOCK_GAP }}>
          {pairs.map((pair, idx) => (
            <div
              key={`${roundLabel}-pair-${idx}`}
              className={cn(
                "flex flex-col",
                align === "left" ? "items-end" : "items-start",
              )}
              style={{ minHeight: SLOT_UNIT * 2 * 2 + PAIR_GAP, gap: PAIR_GAP }}
            >
              {pair.map((match, j) => (
                <XhsMatchCard
                  key={`${match.id ?? j}-${roundLabel}`}
                  match={match}
                  locale={locale}
                  labels={labels}
                  roundLabel={roundLabel}
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
      <RoundTitle label={roundLabel} />
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
              <Connector align={align} span={span} />
            ) : null}
            {match.home || match.away ? (
              <XhsMatchCard
                match={match}
                locale={locale}
                labels={labels}
                roundLabel={roundLabel}
                tree
              />
            ) : (
              <TbdTreeCard label={labels.tbd} locale={locale} />
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
      <RoundTitle label={labels.sf} />
      <div className="flex items-center" style={{ minHeight: treeHeight }}>
        {tree.sf?.home || tree.sf?.away ? (
          <XhsMatchCard
            match={tree.sf}
            locale={locale}
            labels={labels}
            roundLabel={labels.sf}
            tree
          />
        ) : (
          <TbdTreeCard label={labels.tbd} locale={locale} />
        )}
      </div>
    </div>
  );

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

function CenterColumn({
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
    <div
      className="flex shrink-0 flex-col items-center px-2"
      style={{ gap: COL_GAP }}
    >
      <div className="flex flex-col items-center" style={{ minHeight: treeHeight }}>
        <RoundTitle label={labels.final} />
        <div className="mb-2 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
          🏆
        </div>
        {final?.home || final?.away ? (
          <XhsMatchCard
            match={final}
            locale={locale}
            labels={labels}
            roundLabel={labels.final}
            tree
          />
        ) : (
          <TbdTreeCard label={labels.tbd} locale={locale} />
        )}
      </div>

      <div className="flex flex-col items-center">
        <RoundTitle label={labels.bronze} />
        {bronze?.home || bronze?.away ? (
          <XhsMatchCard
            match={bronze}
            locale={locale}
            labels={labels}
            roundLabel={labels.bronze}
            tree
          />
        ) : (
          <TbdTreeCard label={labels.tbd} locale={locale} />
        )}
      </div>
    </div>
  );
}

function ScheduleList({
  bracket,
  locale,
  labels,
}: {
  bracket: KnockoutBracket;
  locale: string;
  labels: Labels;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      {bracket.rounds.map((round) => (
        <div key={round.roundId}>
          <h3 className="mb-2.5 text-sm font-semibold text-zinc-800">{round.label}</h3>
          <div className="flex flex-col gap-2">
            {round.matches.map((match, idx) => (
              <XhsMatchCard
                key={`${round.roundId}-${match.id ?? idx}`}
                match={match}
                locale={locale}
                labels={labels}
                roundLabel={
                  match.id === 103 ? labels.bronze : round.label
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ViewTabs({
  mode,
  onChange,
  labels,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  labels: Labels;
}) {
  const tabs: { id: ViewMode; label: string }[] = [
    { id: "tree", label: labels.tabTree },
    { id: "schedule", label: labels.tabSchedule },
  ];

  return (
    <div className="flex justify-center border-b border-black/[0.06] bg-white px-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative px-5 py-2.5 text-sm font-medium transition-colors",
            mode === tab.id ? "text-[#ff2442]" : "text-zinc-500 hover:text-zinc-700",
          )}
        >
          {tab.label}
          {mode === tab.id ? (
            <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#ff2442]" />
          ) : null}
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
  const [mode, setMode] = useState<ViewMode>("tree");

  return (
    <section className="overflow-hidden rounded-xl border border-border shadow-sm">
      <header className="border-b border-border/60 bg-card/80 px-4 py-4 md:px-6">
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

      <div className="bg-[#f7f7f7] text-zinc-900">
        <ViewTabs mode={mode} onChange={setMode} labels={labels} />

        {mode === "tree" ? (
          <div className="overflow-x-auto p-3 sm:p-4 md:p-5">
            <p className="mb-3 text-center text-[11px] text-zinc-500 sm:hidden">
              {labels.swipeHint}
            </p>
            <div className="mx-auto flex w-max items-start justify-center pb-2">
              <SideTree tree={split.left} locale={locale} labels={labels} align="left" />
              <CenterColumn
                final={split.final}
                bronze={split.bronze}
                locale={locale}
                labels={labels}
              />
              <SideTree tree={split.right} locale={locale} labels={labels} align="right" />
            </div>
          </div>
        ) : (
          <div className="p-3 sm:p-4 md:p-5">
            <ScheduleList bracket={bracket} locale={locale} labels={labels} />
          </div>
        )}
      </div>
    </section>
  );
}
