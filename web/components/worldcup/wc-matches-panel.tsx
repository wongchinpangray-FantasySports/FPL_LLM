"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import type { WcMatchRow } from "@/lib/wc/fifa-rounds";
import { WcMatchDetail } from "@/components/worldcup/wc-match-detail";
import { WcSectionIntro } from "@/components/worldcup/wc-shared";
import { wcTeamFlag } from "@/lib/wc/wc-team-flags";

function fmtKickoff(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusLabel(status: string, period: string | null, minutes: number): string {
  const s = status.toLowerCase();
  if (s === "finished" || s === "complete") return "FT";
  if (s === "scheduled") return "Scheduled";
  if (period && minutes > 0) return `${minutes}'`;
  return status.replace(/_/g, " ");
}

function MatchCard({
  match,
  expanded,
  onToggle,
  locale,
  labels,
}: {
  match: WcMatchRow;
  expanded: boolean;
  onToggle: () => void;
  locale: string;
  labels: {
    expandHint: string;
    collapseHint: string;
    fullTime: string;
    assist: string;
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
  };
}) {
  const live =
    match.status.toLowerCase() !== "scheduled" &&
    match.status.toLowerCase() !== "finished" &&
    match.status.toLowerCase() !== "complete" &&
    match.minutes > 0;
  const finished =
    match.status.toLowerCase() === "finished" ||
    match.status.toLowerCase() === "complete" ||
    match.home_score != null;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "cursor-pointer rounded-lg border transition-colors",
        expanded
          ? "border-brand-accent/30 bg-card p-2 sm:p-3"
          : "border-border bg-card/80 p-3 hover:border-border",
      )}
    >
      {!expanded ? (
        <>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{match.round_label}</span>
            <span
              className={cn(
                live && "font-medium text-brand-accent",
                finished && "text-muted-foreground",
              )}
            >
              {statusLabel(match.status, match.period, match.minutes)}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex min-w-0 items-center justify-end gap-1.5">
              <span className="truncate text-right text-sm font-semibold text-foreground">
                {match.home_name}
              </span>
              <span className="text-base">{wcTeamFlag(match.home_code)}</span>
            </div>
            <div className="px-2 text-center">
              {finished ? (
                <div className="text-lg font-bold tabular-nums text-foreground">
                  {match.home_score ?? 0}
                  <span className="mx-1 text-muted-foreground">–</span>
                  {match.away_score ?? 0}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">vs</div>
              )}
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-base">{wcTeamFlag(match.away_code)}</span>
              <span className="truncate text-sm font-semibold text-foreground">
                {match.away_name}
              </span>
            </div>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {fmtKickoff(match.kickoff)}
            {match.venue ? ` · ${match.venue}` : ""}
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground/80">
            {labels.expandHint}
          </p>
        </>
      ) : (
        <WcMatchDetail match={match} locale={locale} labels={labels} />
      )}
    </article>
  );
}

type MatchesPayload = {
  rounds: number[];
  matches: WcMatchRow[];
  disclaimer: string;
  error?: string;
};

export function WcMatchesPanel({
  title,
  summary,
  detail,
  moreLabel,
  labels,
}: {
  title: string;
  summary: string;
  detail?: string;
  moreLabel: string;
  labels: {
    filterRound: string;
    roundAll: string;
    expandHint: string;
    collapseHint: string;
    fullTime: string;
    assist: string;
    loading: string;
    empty: string;
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
  };
}) {
  const locale = useLocale();
  const [round, setRound] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MatchesPayload | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async (roundFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (roundFilter !== "ALL") params.set("round", roundFilter);
      params.set("locale", locale);
      const q = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/worldcup/matches${q}`);
      const json = (await res.json()) as MatchesPayload;
      if (!res.ok) throw new Error(json.error ?? "Failed to load matches");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void load(round);
  }, [load, round]);

  const matches = data?.matches ?? [];

  const roundOptions = [
    { value: "ALL", label: labels.roundAll },
    ...(data?.rounds ?? []).map((r) => ({
      value: String(r),
      label: r <= 3 ? `MD${r}` : r === 8 ? "Final" : `R${r}`,
    })),
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <WcSectionIntro
          title={title}
          summary={summary}
          detail={detail}
          moreLabel={moreLabel}
        />
        <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span>{labels.filterRound}</span>
          <select
            value={round}
            onChange={(e) => setRound(e.target.value)}
            className="rounded-md border border-border bg-popover/80 px-2 py-1.5 text-sm text-foreground"
          >
            {roundOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{labels.loading}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {!loading && !error && matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : null}

      <div
        className={cn(
          "grid gap-2",
          expandedId != null ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {matches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            expanded={expandedId === m.id}
            onToggle={() =>
              setExpandedId(expandedId === m.id ? null : m.id)
            }
            locale={locale}
            labels={labels}
          />
        ))}
      </div>
    </section>
  );
}
