"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getFplTeamBadgeStyle, getFplTeamTheme } from "@/lib/team-themes";
import {
  formatPlSeason,
  getH2HHistory,
  resultForTeam,
  type H2HMatch,
} from "@/lib/fpl/h2h-history";

export type FixtureSelection = {
  team: string;
  teamName: string;
  opp: string;
  oppName: string;
  home: boolean;
  gw: number;
};

function ResultBadge({ result }: { result: "W" | "D" | "L" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded px-1 text-[10px] font-bold uppercase",
        result === "W" && "bg-emerald-500/25 text-emerald-300",
        result === "D" && "bg-muted text-muted-foreground",
        result === "L" && "bg-rose-500/25 text-rose-300",
      )}
    >
      {result}
    </span>
  );
}

function TeamChip({ code, name }: { code: string; name?: string }) {
  const badge = getFplTeamBadgeStyle(code);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold shadow-sm"
      style={{
        background: badge.chipBg,
        color: badge.color,
        borderColor: badge.chipBorder,
      }}
      title={name ?? code}
    >
      {code}
    </span>
  );
}

export function FplFixtureH2hModal({
  open,
  selection,
  h2hHistory,
  labels,
  onClose,
}: {
  open: boolean;
  selection: FixtureSelection | null;
  h2hHistory: Record<string, H2HMatch[]>;
  labels: {
    h2hTitleHome: string;
    h2hTitleAway: string;
    h2hEmptyHome: string;
    h2hEmptyAway: string;
    home: string;
    away: string;
    close: string;
  };
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !selection) return null;

  const matches = getH2HHistory(
    h2hHistory,
    selection.team,
    selection.opp,
    selection.home,
  );
  const teamBadge = getFplTeamBadgeStyle(selection.team);
  const oppBadge = getFplTeamBadgeStyle(selection.opp);
  const teamTheme = getFplTeamTheme(selection.team);
  const oppTheme = getFplTeamTheme(selection.opp);
  const h2hTitle = selection.home ? labels.h2hTitleHome : labels.h2hTitleAway;
  const h2hEmpty = selection.home ? labels.h2hEmptyHome : labels.h2hEmptyAway;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fpl-h2h-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label={labels.close}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-[101] flex max-h-[min(85vh,640px)] w-full flex-col",
          "rounded-t-2xl border border-border bg-background shadow-2xl sm:max-w-md sm:rounded-2xl",
        )}
      >
        <div
          className="shrink-0 rounded-t-2xl px-5 pb-4 pt-5 sm:rounded-t-2xl"
          style={{
            background: `linear-gradient(135deg, ${teamTheme.primary}28 0%, ${oppTheme.primary}22 55%, transparent 100%)`,
          }}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            GW{selection.gw} · {h2hTitle}
          </p>
          <h2
            id="fpl-h2h-title"
            className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground"
          >
            <TeamChip code={selection.team} name={selection.teamName} />
            <span className="text-muted-foreground">vs</span>
            <TeamChip code={selection.opp} name={selection.oppName} />
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {selection.teamName}{" "}
            <span
              className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
              style={{
                backgroundColor: selection.home
                  ? `${teamBadge.bg}33`
                  : `${oppBadge.bg}33`,
                color: selection.home ? teamBadge.color : oppBadge.color,
              }}
            >
              {selection.home ? labels.home : labels.away}
            </span>
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {matches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {h2hEmpty}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {matches.map((m, i) => {
                const result = resultForTeam(m, selection.team);
                const date = m.kickoff
                  ? new Date(m.kickoff).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : null;
                const homeBadge = getFplTeamBadgeStyle(m.home);
                const awayBadge = getFplTeamBadgeStyle(m.away);
                return (
                  <li
                    key={`${m.season}:${m.home}:${m.away}:${i}`}
                    className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/80 px-3 py-2.5"
                  >
                    <ResultBadge result={result} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-sm font-semibold tabular-nums">
                        <span
                          className="rounded px-1.5 py-0.5 text-xs"
                          style={{
                            background:
                              m.home === selection.team
                                ? homeBadge.chipBg
                                : `${homeBadge.bg}22`,
                            color:
                              m.home === selection.team
                                ? homeBadge.color
                                : "inherit",
                          }}
                        >
                          {m.home}
                        </span>
                        <span className="text-foreground">
                          {m.homeScore}–{m.awayScore}
                        </span>
                        <span
                          className="rounded px-1.5 py-0.5 text-xs"
                          style={{
                            background:
                              m.away === selection.team
                                ? awayBadge.chipBg
                                : `${awayBadge.bg}22`,
                            color:
                              m.away === selection.team
                                ? awayBadge.color
                                : "inherit",
                          }}
                        >
                          {m.away}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatPlSeason(m.season)}
                        {date ? ` · ${date}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={onClose}
          >
            {labels.close}
          </Button>
        </div>
      </div>
    </div>
  );
}
