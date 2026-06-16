"use client";

import { useState } from "react";
import { isWcMatchFinished, type WcMatchGoal, type WcMatchRow } from "@/lib/wc/fifa-rounds";
import { wcTeamFlag } from "@/lib/wc/wc-team-flags";
import { WcMatchSummaryModal } from "@/components/worldcup/wc-match-summary-modal";
import { Button } from "@/components/ui/button";

function GoalIcon() {
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px]"
      aria-hidden
    >
      ⚽
    </span>
  );
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
        <div className="text-sm font-medium leading-snug text-slate-200">
          {goal.scorer_display}
        </div>
        {goal.assist_display ? (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {assistLabel}: {goal.assist_display}
          </p>
        ) : null}
      </div>
      <GoalIcon />
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
      <GoalIcon />
      <div className="min-w-0 text-left">
        <div className="text-sm font-medium leading-snug text-slate-200">
          {goal.scorer_display}
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

export function WcMatchDetail({
  match,
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
    summaryListen: string;
    summaryPause: string;
    summaryResume: string;
    summaryStop: string;
    summaryClose: string;
  };
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const finished = isWcMatchFinished(match);

  const homeGoals = match.home_goals ?? [];
  const awayGoals = match.away_goals ?? [];
  const hasGoals = homeGoals.length > 0 || awayGoals.length > 0;

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

          {hasGoals ? (
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/[0.06] pt-3">
              <div className="space-y-2.5">
                {homeGoals.map((g, i) => (
                  <HomeGoalRow
                    key={`hg-${i}`}
                    goal={g}
                    assistLabel={labels.assist}
                  />
                ))}
              </div>
              <div className="space-y-2.5">
                {awayGoals.map((g, i) => (
                  <AwayGoalRow
                    key={`ag-${i}`}
                    goal={g}
                    assistLabel={labels.assist}
                  />
                ))}
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
