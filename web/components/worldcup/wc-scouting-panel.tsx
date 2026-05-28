"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { WcScoutArchetype, WcScoutPick, WcScoutingReport } from "@/lib/wc/scouting";
import { SCOUT_ARCHETYPES } from "@/lib/wc/scouting";

const ARCHETYPE_STYLE: Record<
  WcScoutArchetype,
  { ring: string; badge: string; glow: string }
> = {
  hidden_killer: {
    ring: "from-rose-500/40 to-orange-600/20",
    badge: "bg-rose-500/20 text-rose-200 ring-rose-400/30",
    glow: "shadow-[0_0_24px_-8px_rgba(244,63,94,0.45)]",
  },
  unsung_hero: {
    ring: "from-amber-400/40 to-yellow-600/15",
    badge: "bg-amber-500/20 text-amber-100 ring-amber-400/30",
    glow: "shadow-[0_0_24px_-8px_rgba(245,158,11,0.4)]",
  },
  silent_wall: {
    ring: "from-sky-500/35 to-indigo-600/15",
    badge: "bg-sky-500/20 text-sky-100 ring-sky-400/30",
    glow: "shadow-[0_0_24px_-8px_rgba(56,189,248,0.35)]",
  },
  indestructible_gate: {
    ring: "from-emerald-500/35 to-teal-600/15",
    badge: "bg-emerald-500/20 text-emerald-100 ring-emerald-400/30",
    glow: "shadow-[0_0_24px_-8px_rgba(52,211,153,0.35)]",
  },
};

function clubSourceLabel(
  source: string | null,
  labels: { fpl: string; wikidata: string; footballData: string },
): string | null {
  if (!source) return null;
  if (source === "fpl") return labels.fpl;
  if (source === "wikidata") return labels.wikidata;
  if (source === "football-data") return labels.footballData;
  return source;
}

function SeasonDetail({
  pick,
  labels,
}: {
  pick: WcScoutPick;
  labels: {
    seasonClub: string;
    seasonLeague: string;
    fplName: string;
    noClub: string;
    clubSource: string;
    sourceFpl: string;
    sourceWikidata: string;
    sourceFootballData: string;
    fifaStats: string;
    goals: string;
    assists: string;
    minutes: string;
    form: string;
    xg: string;
    xa: string;
  };
}) {
  const sourceNote = clubSourceLabel(pick.club_source, {
    fpl: labels.sourceFpl,
    wikidata: labels.sourceWikidata,
    footballData: labels.sourceFootballData,
  });

  if (!pick.season_club && !pick.season_stats) {
    return (
      <p className="text-[11px] text-slate-500">{labels.noClub}</p>
    );
  }

  const s = pick.season_stats;

  return (
    <dl className="grid gap-2 text-[11px]">
      {pick.season_club ? (
        <>
          <div className="flex justify-between gap-2 border-b border-white/5 pb-2">
            <dt className="text-slate-500">{labels.seasonClub}</dt>
            <dd className="text-right font-medium text-white">{pick.season_club}</dd>
          </div>
          {pick.season_league ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{labels.seasonLeague}</dt>
              <dd className="text-right text-slate-300">{pick.season_league}</dd>
            </div>
          ) : null}
          {sourceNote ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{labels.clubSource}</dt>
              <dd className="text-right text-slate-400">{sourceNote}</dd>
            </div>
          ) : null}
          {pick.fpl_web_name ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{labels.fplName}</dt>
              <dd className="text-right text-slate-300">{pick.fpl_web_name}</dd>
            </div>
          ) : null}
        </>
      ) : null}
      {s && !pick.fpl_linked ? (
        <p className="text-[10px] text-slate-600">{labels.fifaStats}</p>
      ) : null}
      {s ? (
        <div className="mt-1 grid grid-cols-3 gap-2 rounded-md bg-white/[0.03] p-2">
          <div>
            <dt className="text-slate-600">{labels.goals}</dt>
            <dd className="font-medium text-slate-200">{s.goals}</dd>
          </div>
          <div>
            <dt className="text-slate-600">{labels.assists}</dt>
            <dd className="font-medium text-slate-200">{s.assists}</dd>
          </div>
          <div>
            <dt className="text-slate-600">{labels.minutes}</dt>
            <dd className="font-medium text-slate-200">{s.minutes}</dd>
          </div>
          <div>
            <dt className="text-slate-600">{labels.xg}</dt>
            <dd className="font-medium text-slate-200">{s.xg.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-slate-600">{labels.xa}</dt>
            <dd className="font-medium text-slate-200">{s.xa.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-slate-600">{labels.form}</dt>
            <dd className="font-medium text-slate-200">{s.form.toFixed(1)}</dd>
          </div>
        </div>
      ) : null}
    </dl>
  );
}

function GemCard({
  pick,
  rank,
  expanded,
  onToggle,
  labels,
}: {
  pick: WcScoutPick;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  labels: {
    owned: string;
    xp: string;
    gem: string;
    tapHint: string;
    seasonClub: string;
    seasonLeague: string;
    fplName: string;
    noClub: string;
    clubSource: string;
    sourceFpl: string;
    sourceWikidata: string;
    sourceFootballData: string;
    fifaStats: string;
    goals: string;
    assists: string;
    minutes: string;
    form: string;
    xg: string;
    xa: string;
  };
}) {
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
        "group relative cursor-pointer rounded-lg border bg-slate-950/50 p-3 transition-colors",
        expanded
          ? "border-brand-accent/30 bg-white/[0.05] ring-1 ring-brand-accent/20"
          : "border-white/[0.06] hover:border-white/12 hover:bg-white/[0.04]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-semibold text-slate-400">
              {rank}
            </span>
            <h4 className="truncate text-sm font-semibold text-white">{pick.name}</h4>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {pick.team_name} · {pick.position}
            {pick.season_club ? ` · ${pick.season_club}` : ""}
          </p>
        </div>
        <span
          className="shrink-0 rounded-md bg-brand-accent/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-brand-accent"
          title={labels.gem}
        >
          {pick.gem_score.toFixed(1)}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
        <div>
          <dt className="text-slate-600">{labels.owned}</dt>
          <dd className="font-medium text-slate-300">{pick.selection_pct.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-slate-600">{labels.xp}</dt>
          <dd className="font-medium text-brand-accent">{pick.xp_total.toFixed(1)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-slate-600">$</dt>
          <dd className="font-medium text-slate-300">
            {pick.price != null ? pick.price.toFixed(1) : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-slate-400">{pick.insight}</p>
      {!expanded ? (
        <p className="mt-2 text-[10px] text-slate-600">{labels.tapHint}</p>
      ) : (
        <div
          className="mt-3 border-t border-white/10 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <SeasonDetail pick={pick} labels={labels} />
        </div>
      )}
    </article>
  );
}

function ArchetypeColumn({
  archetype,
  picks,
  title,
  tagline,
  position,
  expandedId,
  onExpand,
  labels,
}: {
  archetype: WcScoutArchetype;
  picks: WcScoutPick[];
  title: string;
  tagline: string;
  position: string;
  expandedId: number | null;
  onExpand: (id: number | null) => void;
  labels: {
    owned: string;
    xp: string;
    gem: string;
    empty: string;
    tapHint: string;
    seasonClub: string;
    seasonLeague: string;
    fplName: string;
    noClub: string;
    clubSource: string;
    sourceFpl: string;
    sourceWikidata: string;
    sourceFootballData: string;
    fifaStats: string;
    goals: string;
    assists: string;
    minutes: string;
    form: string;
    xg: string;
    xa: string;
  };
}) {
  const style = ARCHETYPE_STYLE[archetype];

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b p-[1px]",
        style.ring,
        style.glow,
      )}
    >
      <div className="flex flex-1 flex-col rounded-[11px] bg-slate-950/90">
        <header className="border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1",
                style.badge,
              )}
            >
              {position}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{tagline}</p>
        </header>
        <div className="flex flex-col gap-2 p-3">
          {picks.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">{labels.empty}</p>
          ) : (
            picks.map((pick, i) => (
              <GemCard
                key={pick.id}
                pick={pick}
                rank={i + 1}
                expanded={expandedId === pick.id}
                onToggle={() =>
                  onExpand(expandedId === pick.id ? null : pick.id)
                }
                labels={labels}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export function WcScoutingPanel({
  report,
  labels,
}: {
  report: WcScoutingReport;
  labels: {
    title: string;
    hint: string;
    meta: string;
    archetypes: Record<WcScoutArchetype, { title: string; tagline: string }>;
    owned: string;
    xp: string;
    gem: string;
    empty: string;
    positions: Record<string, string>;
    tapHint: string;
    seasonClub: string;
    seasonLeague: string;
    fplName: string;
    noClub: string;
    clubSource: string;
    sourceFpl: string;
    sourceWikidata: string;
    sourceFootballData: string;
    fifaStats: string;
    goals: string;
    assists: string;
    minutes: string;
    form: string;
    xg: string;
    xa: string;
  };
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">
          {labels.title}
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
          {labels.hint}
        </p>
        <p className="mt-2 text-[11px] text-slate-500">
          {labels.meta
            .replace("{scanned}", String(report.scanned))
            .replace("{spotlight}", String(report.excluded_spotlight))
            .replace("{popular}", String(report.excluded_popular))}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {SCOUT_ARCHETYPES.map((archetype) => {
          const copy = labels.archetypes[archetype];
          const posKey =
            archetype === "hidden_killer"
              ? "FWD"
              : archetype === "unsung_hero"
                ? "MID"
                : archetype === "silent_wall"
                  ? "DEF"
                  : "GKP";
          return (
            <ArchetypeColumn
              key={archetype}
              archetype={archetype}
              picks={report.picks[archetype]}
              title={copy.title}
              tagline={copy.tagline}
              position={labels.positions[posKey] ?? posKey}
              expandedId={expandedId}
              onExpand={setExpandedId}
              labels={{
                owned: labels.owned,
                xp: labels.xp,
                gem: labels.gem,
                empty: labels.empty,
                tapHint: labels.tapHint,
                seasonClub: labels.seasonClub,
                seasonLeague: labels.seasonLeague,
                fplName: labels.fplName,
                noClub: labels.noClub,
                clubSource: labels.clubSource,
                sourceFpl: labels.sourceFpl,
                sourceWikidata: labels.sourceWikidata,
                sourceFootballData: labels.sourceFootballData,
                fifaStats: labels.fifaStats,
                goals: labels.goals,
                assists: labels.assists,
                minutes: labels.minutes,
                form: labels.form,
                xg: labels.xg,
                xa: labels.xa,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
