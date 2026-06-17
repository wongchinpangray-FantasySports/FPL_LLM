"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  isWcMatchFinished,
  type WcMatchCardEvent,
  type WcMatchGoal,
  type WcMatchRow,
} from "@/lib/wc/fifa-rounds";
import { wcTeamFlag } from "@/lib/wc/wc-team-flags";
import { WcMatchSummaryModal } from "@/components/worldcup/wc-match-summary-modal";
import { Button } from "@/components/ui/button";

function GoalIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px]",
        className,
      )}
      aria-hidden
    >
      ⚽
    </span>
  );
}

function CardIcon({ card }: { card: "yellow" | "red" }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-3 shrink-0 rounded-sm",
        card === "red" ? "bg-rose-500" : "bg-amber-400",
      )}
      aria-hidden
    />
  );
}

function fmtMinute(minute: string | null): string {
  if (!minute) return "";
  return minute.includes("'") ? minute : `${minute}'`;
}

function HomeGoalRow({
  goal,
  assistLabel,
}: {
  goal: WcMatchGoal;
  assistLabel: string;
}) {
  return (
    <div className="flex items-start justify-end gap-2">
      <div className="min-w-0 text-right">
        <div className="text-sm leading-snug text-slate-200">
          {goal.minute ? (
            <span className="mr-1.5 tabular-nums text-slate-400">
              {fmtMinute(goal.minute)}
            </span>
          ) : null}
          <span className="font-medium">{goal.scorer_display}</span>
        </div>
        {goal.assist_display ? (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {assistLabel}: {goal.assist_display}
          </p>
        ) : null}
      </div>
      <GoalIcon className="mt-0.5" />
    </div>
  );
}

function AwayGoalRow({
  goal,
  assistLabel,
}: {
  goal: WcMatchGoal;
  assistLabel: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <GoalIcon className="mt-0.5" />
      <div className="min-w-0 text-left">
        <div className="text-sm leading-snug text-slate-200">
          <span className="font-medium">{goal.scorer_display}</span>
          {goal.minute ? (
            <span className="ml-1.5 tabular-nums text-slate-400">
              {fmtMinute(goal.minute)}
            </span>
          ) : null}
        </div>
        {goal.assist_display ? (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {assistLabel}: {goal.assist_display}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function HomeCardRow({ event }: { event: WcMatchCardEvent }) {
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-slate-300">
      {event.minute ? (
        <span className="tabular-nums text-slate-400">
          {fmtMinute(event.minute)}
        </span>
      ) : null}
      <span className="font-medium">{event.player_display}</span>
      <CardIcon card={event.card} />
    </div>
  );
}

function AwayCardRow({ event }: { event: WcMatchCardEvent }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <CardIcon card={event.card} />
      <span className="font-medium">{event.player_display}</span>
      {event.minute ? (
        <span className="tabular-nums text-slate-400">
          {fmtMinute(event.minute)}
        </span>
      ) : null}
    </div>
  );
}

function hasEventTimeline(match: WcMatchRow): boolean {
  const goals = [...(match.home_goals ?? []), ...(match.away_goals ?? [])];
  const cards = [...(match.home_cards ?? []), ...(match.away_cards ?? [])];
  return goals.some((g) => g.minute) || cards.length > 0;
}

export function WcMatchDetail({
  match: initialMatch,
  locale,
  labels,
}: {
  match: WcMatchRow;
  locale: string;
  labels: {
    fullTime: string;
    assist: string;
    collapseHint: string;
    summaryButton: string;
    summaryTitle: string;
    summaryLoading: string;
    summaryError: string;
    summaryAudioLoading: string;
    summaryListen: string;
    summaryPause: string;
    summaryResume: string;
    summaryStop: string;
    summaryClose: string;
    eventsLoading?: string;
  };
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [match, setMatch] = useState(initialMatch);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    setMatch(initialMatch);
  }, [initialMatch]);

  const finished = isWcMatchFinished(match);

  useEffect(() => {
    if (!finished || hasEventTimeline(match)) return;

    let cancelled = false;
    setEventsLoading(true);
    fetch(`/api/worldcup/match-events?matchId=${match.id}`)
      .then(async (res) => {
        const json = (await res.json()) as {
          match?: WcMatchRow;
          error?: string;
        };
        if (!res.ok || !json.match) return;
        if (!cancelled) setMatch(json.match);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [match.id, finished]);

  const homeGoals = match.home_goals ?? [];
  const awayGoals = match.away_goals ?? [];
  const homeCards = match.home_cards ?? [];
  const awayCards = match.away_cards ?? [];

  const homeEvents = [
    ...homeGoals.map((g) => ({ kind: "goal" as const, sort: g.sort_key, g })),
    ...homeCards.map((c) => ({ kind: "card" as const, sort: c.sort_key, c })),
  ].sort((a, b) => b.sort - a.sort);

  const awayEvents = [
    ...awayGoals.map((g) => ({ kind: "goal" as const, sort: g.sort_key, g })),
    ...awayCards.map((c) => ({ kind: "card" as const, sort: c.sort_key, c })),
  ].sort((a, b) => b.sort - a.sort);

  const hasEvents = homeEvents.length > 0 || awayEvents.length > 0;

  const summaryTitle = labels.summaryTitle
    .replace("{home}", match.home_name)
    .replace("{away}", match.away_name);

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex min-w-0 items-center justify-end gap-2">
              <span className="truncate text-right text-xs font-bold uppercase tracking-wide text-white sm:text-sm">
                {match.home_name}
              </span>
              <span className="text-lg leading-none">{wcTeamFlag(match.home_code)}</span>
            </div>

            <div className="px-2 text-center">
              {finished ? (
                <>
                  <div className="text-xl font-bold tabular-nums text-white sm:text-2xl">
                    {match.home_score ?? 0}
                    <span className="mx-1.5 font-normal text-slate-500">-</span>
                    {match.away_score ?? 0}
                  </div>
                  <span className="mt-1 inline-block rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-900">
                    {labels.fullTime}
                  </span>
                </>
              ) : (
                <div className="text-sm text-slate-500">vs</div>
              )}
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <span className="text-lg leading-none">{wcTeamFlag(match.away_code)}</span>
              <span className="truncate text-left text-xs font-bold uppercase tracking-wide text-white sm:text-sm">
                {match.away_name}
              </span>
            </div>
          </div>

          {eventsLoading && !hasEvents ? (
            <p className="mt-4 border-t border-white/[0.06] pt-3 text-center text-xs text-slate-500">
              {labels.eventsLoading ?? "Loading timeline…"}
            </p>
          ) : null}

          {hasEvents ? (
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/[0.06] pt-3">
              <div className="space-y-2.5">
                {homeEvents.map((ev, i) =>
                  ev.kind === "goal" ? (
                    <HomeGoalRow
                      key={`hg-${i}`}
                      goal={ev.g}
                      assistLabel={labels.assist}
                    />
                  ) : (
                    <HomeCardRow key={`hc-${i}`} event={ev.c} />
                  ),
                )}
              </div>
              <div className="space-y-2.5">
                {awayEvents.map((ev, i) =>
                  ev.kind === "goal" ? (
                    <AwayGoalRow
                      key={`ag-${i}`}
                      goal={ev.g}
                      assistLabel={labels.assist}
                    />
                  ) : (
                    <AwayCardRow key={`ac-${i}`} event={ev.c} />
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>

        {finished ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setSummaryOpen(true);
              }}
            >
              <span aria-hidden>🎙</span>
              {labels.summaryButton}
            </Button>
          </div>
        ) : null}

        <p className="text-center text-xs text-slate-600">{labels.collapseHint}</p>
      </div>

      <WcMatchSummaryModal
        open={summaryOpen}
        title={summaryTitle}
        matchId={match.id}
        locale={locale}
        labels={{
          loading: labels.summaryLoading,
          error: labels.summaryError,
          audioLoading: labels.summaryAudioLoading,
          listen: labels.summaryListen,
          pause: labels.summaryPause,
          resume: labels.summaryResume,
          stop: labels.summaryStop,
          close: labels.summaryClose,
        }}
        onClose={() => setSummaryOpen(false)}
      />
    </>
  );
}
