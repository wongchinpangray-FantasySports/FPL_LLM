"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { WcScoutArchetype, WcScoutPick, WcScoutingReport } from "@/lib/wc/scouting";
import { SCOUT_ARCHETYPES } from "@/lib/wc/scouting";
import {
  WcPlayerNameRow,
  WcSectionIntro,
  WcStatChip,
} from "@/components/worldcup/wc-shared";

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
  const s = pick.season_stats;

  return (
    <div className="space-y-2.5 text-xs">
      <p className="text-xs leading-relaxed text-slate-400">{pick.insight}</p>
      {pick.season_club || s ? (
        <dl className="space-y-2 rounded-lg bg-white/[0.03] p-2.5">
          {pick.season_club ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="shrink-0 text-slate-500">{labels.seasonClub}</dt>
                <dd className="text-right text-sm font-medium text-white">{pick.season_club}</dd>
              </div>
              {pick.season_league ? (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="shrink-0 text-slate-500">{labels.seasonLeague}</dt>
                  <dd className="text-right text-sm text-slate-300">{pick.season_league}</dd>
                </div>
              ) : null}
              {sourceNote ? (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="shrink-0 text-slate-500">Source</dt>
                  <dd className="text-right text-sm text-slate-400">{sourceNote}</dd>
                </div>
              ) : null}
              {pick.fpl_web_name ? (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="shrink-0 text-slate-500">{labels.fplName}</dt>
                  <dd className="text-right text-sm text-slate-300">{pick.fpl_web_name}</dd>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-slate-500">{labels.noClub}</p>
          )}
          {s ? (
            <div className="grid grid-cols-3 gap-x-2 gap-y-2 border-t border-white/5 pt-2">
              {(
                [
                  [labels.goals, String(s.goals)],
                  [labels.assists, String(s.assists)],
                  [labels.minutes, String(s.minutes)],
                  [labels.xg, s.xg.toFixed(2)],
                  [labels.xa, s.xa.toFixed(2)],
                  [labels.form, s.form.toFixed(1)],
                ] as const
              ).map(([lbl, val]) => (
                <div key={lbl} className="text-center">
                  <dt className="text-[10px] text-slate-500">{lbl}</dt>
                  <dd className="text-sm font-medium tabular-nums text-slate-200">{val}</dd>
                </div>
              ))}
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="text-xs text-slate-500">{labels.noClub}</p>
      )}
    </div>
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
    expandHint: string;
    copyName: string;
    copiedName: string;
    seasonClub: string;
    seasonLeague: string;
    fplName: string;
    noClub: string;
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
        "cursor-pointer rounded-lg border p-3 transition-colors",
        expanded
          ? "border-brand-accent/30 bg-white/[0.05] ring-1 ring-brand-accent/20"
          : "border-white/[0.06] bg-slate-950/50 hover:border-white/12 hover:bg-white/[0.04]",
      )}
    >
      <WcPlayerNameRow
        name={pick.name}
        rank={rank}
        copyLabel={labels.copyName}
        copiedLabel={labels.copiedName}
      />
      <p className="mt-1 text-xs text-slate-500">
        {pick.team_name} · {pick.position}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <WcStatChip label={labels.owned} value={`${pick.selection_pct.toFixed(1)}%`} />
        <WcStatChip
          label={labels.xp}
          value={pick.xp_total.toFixed(1)}
          accent
        />
        <WcStatChip label={labels.gem} value={pick.gem_score.toFixed(1)} />
      </div>
      {!expanded ? (
        <p className="mt-2 text-center text-xs text-slate-500">{labels.expandHint}</p>
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
    expandHint: string;
    copyName: string;
    copiedName: string;
    seasonClub: string;
    seasonLeague: string;
    fplName: string;
    noClub: string;
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
        "flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b p-px",
        style.ring,
        style.glow,
      )}
    >
      <div className="flex flex-1 flex-col rounded-[11px] bg-slate-950/90">
        <header className="border-b border-white/[0.06] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium uppercase ring-1",
                style.badge,
              )}
            >
              {position}
            </span>
          </div>
          <p className="mt-1 text-xs leading-snug text-slate-500">{tagline}</p>
        </header>
        <div className="flex flex-col gap-2 p-2.5">
          {picks.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">{labels.empty}</p>
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
    summary: string;
    detail: string;
    moreDetail: string;
    meta: string;
    archetypes: Record<WcScoutArchetype, { title: string; tagline: string }>;
    owned: string;
    xp: string;
    gem: string;
    empty: string;
    expandHint: string;
    copyName: string;
    copiedName: string;
    positions: Record<string, string>;
    seasonClub: string;
    seasonLeague: string;
    fplName: string;
    noClub: string;
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
      <WcSectionIntro
        title={labels.title}
        summary={labels.summary}
        detail={
          labels.meta
            ? `${labels.detail}\n\n${labels.meta}`
            : labels.detail
        }
        moreLabel={labels.moreDetail}
      />
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
                expandHint: labels.expandHint,
                copyName: labels.copyName,
                copiedName: labels.copiedName,
                seasonClub: labels.seasonClub,
                seasonLeague: labels.seasonLeague,
                fplName: labels.fplName,
                noClub: labels.noClub,
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
