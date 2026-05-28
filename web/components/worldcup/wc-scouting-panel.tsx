"use client";

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

function GemCard({
  pick,
  rank,
  labels,
}: {
  pick: WcScoutPick;
  rank: number;
  labels: {
    owned: string;
    xp: string;
    gem: string;
  };
}) {
  return (
    <article className="group relative rounded-lg border border-white/[0.06] bg-slate-950/50 p-3 transition-colors hover:border-white/12 hover:bg-white/[0.04]">
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
    </article>
  );
}

function ArchetypeColumn({
  archetype,
  picks,
  title,
  tagline,
  position,
  labels,
}: {
  archetype: WcScoutArchetype;
  picks: WcScoutPick[];
  title: string;
  tagline: string;
  position: string;
  labels: {
    owned: string;
    xp: string;
    gem: string;
    empty: string;
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
              <GemCard key={pick.id} pick={pick} rank={i + 1} labels={labels} />
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
  };
}) {
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
              labels={{
                owned: labels.owned,
                xp: labels.xp,
                gem: labels.gem,
                empty: labels.empty,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
