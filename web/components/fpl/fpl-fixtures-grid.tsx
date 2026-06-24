"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { fdrClass } from "@/lib/fpl/fdr";
import { getFplTeamBadgeStyle } from "@/lib/team-themes";
import type { H2HMatch } from "@/lib/fpl/h2h-history";
import type { FplFixtureRow, FplGwBlock } from "@/lib/fpl/fixtures-grid";
import {
  FplFixtureH2hModal,
  type FixtureSelection,
} from "@/components/fpl/fpl-fixture-h2h-modal";

function FixtureChip({
  fixture,
  onSelect,
  labels,
}: {
  fixture: FplFixtureRow["fixtures"][number];
  onSelect: () => void;
  labels: { home: string; away: string; h2hTapHint: string };
}) {
  const oppBadge = getFplTeamBadgeStyle(fixture.opp);
  const teamSide = fixture.home ? labels.home : labels.away;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border text-left transition-all",
        "hover:-translate-y-0.5 hover:border-brand-accent/35 hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50",
        fdrClass(fixture.fdr),
      )}
      title={`FDR ${fixture.fdr} · ${labels.h2hTapHint}`}
    >
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: oppBadge.chipBg }}
        aria-hidden
      />
      <span className="flex flex-col gap-1.5 px-2.5 py-2 pl-3.5">
        <span className="flex items-center justify-between gap-1.5">
          <span
            className="rounded-md px-1.5 py-0.5 text-[12px] font-bold tracking-tight"
            style={{
              background: oppBadge.chipBg,
              color: oppBadge.color,
            }}
          >
            {fixture.opp}
          </span>
          <span className="text-[10px] font-semibold tabular-nums text-foreground/90">
            FDR {fixture.fdr}
          </span>
        </span>
        <span className="flex items-center justify-between gap-1.5">
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
              fixture.home
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                : "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30",
            )}
          >
            {teamSide}
          </span>
        </span>
        <span className="text-[10px] text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100">
          {labels.h2hTapHint}
        </span>
      </span>
    </button>
  );
}

function FixtureCell({
  fs,
  isDgw,
  dgwLabel,
  onSelectFixture,
  labels,
}: {
  fs: FplFixtureRow["fixtures"];
  isDgw: boolean;
  dgwLabel: string;
  onSelectFixture: (f: FplFixtureRow["fixtures"][number]) => void;
  labels: {
    home: string;
    away: string;
    h2hTapHint: string;
  };
}) {
  return (
    <div
      className={cn(
        "flex min-w-[5.5rem] flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/20 p-1",
        isDgw &&
          "ring-2 ring-amber-400/70 ring-offset-1 ring-offset-background",
      )}
    >
      {fs.map((f) => (
        <FixtureChip
          key={f.fixture_id}
          fixture={f}
          onSelect={() => onSelectFixture(f)}
          labels={labels}
        />
      ))}
      {isDgw && fs.length >= 2 ? (
        <div className="px-1 pb-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-amber-300/90">
          {dgwLabel}
        </div>
      ) : null}
    </div>
  );
}

function TeamRow({
  row,
  gwHeaders,
  dgwKeys,
  expanded,
  onToggle,
  onSelectFixture,
  labels,
}: {
  row: FplFixtureRow;
  gwHeaders: number[];
  dgwKeys: Set<string>;
  expanded: boolean;
  onToggle: () => void;
  onSelectFixture: (
    row: FplFixtureRow,
    fixture: FplFixtureRow["fixtures"][number],
  ) => void;
  labels: {
    expandHint: string;
    gwLabel: string;
    dgw: string;
    home: string;
    away: string;
    h2hTapHint: string;
  };
}) {
  const badge = getFplTeamBadgeStyle(row.short);

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
        "cursor-pointer overflow-hidden rounded-xl border transition-colors md:hidden",
        expanded
          ? "border-brand-accent/30 bg-card"
          : "border-border bg-card/80",
      )}
    >
      <div
        className="flex items-center gap-3 px-3 py-3"
        style={{
          background: `linear-gradient(90deg, ${badge.rowTint}, transparent)`,
        }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold shadow-sm"
          style={{
            background: badge.chipBg,
            color: badge.color,
            boxShadow: `inset 0 0 0 1px ${badge.chipBorder}`,
          }}
        >
          {row.short}
        </span>
        <h3 className="min-w-0 flex-1 font-semibold text-foreground [overflow-wrap:anywhere]">
          {row.name}
        </h3>
      </div>
      {!expanded ? (
        <p className="border-t border-border/50 px-3 py-2 text-[10px] text-muted-foreground/80">
          {labels.expandHint}
        </p>
      ) : (
        <div className="border-t border-border/50 px-3 pb-3 pt-2">
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              {gwHeaders.map((gw) => {
                const fs = row.fixtures.filter((x) => x.gw === gw);
                const isDgw =
                  fs.length >= 2 || dgwKeys.has(`${row.team_id}:${gw}`);
                return fs.length > 0 ? (
                  <div key={gw} className="shrink-0">
                    <div className="mb-1.5 text-center text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                      {labels.gwLabel}
                      {gw}
                    </div>
                    <FixtureCell
                      fs={fs}
                      isDgw={isDgw}
                      dgwLabel={labels.dgw}
                      onSelectFixture={(f) => onSelectFixture(row, f)}
                      labels={labels}
                    />
                  </div>
                ) : (
                  <div
                    key={gw}
                    className="flex min-w-[3rem] shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-border/50 px-2 py-3 text-center text-muted-foreground/60"
                  >
                    <div className="text-[9px] uppercase">
                      {labels.gwLabel}
                      {gw}
                    </div>
                    <span className="mt-1 text-xs">—</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export function FplFixturesGrid({
  rows,
  gwBlocks,
  dgwKeys,
  h2hHistory,
  title,
  summary,
  hint,
  labels,
}: {
  rows: FplFixtureRow[];
  gwBlocks: FplGwBlock[];
  dgwKeys: string[];
  h2hHistory: Record<string, H2HMatch[]>;
  title: string;
  summary?: string;
  hint?: string;
  labels: {
    team: string;
    expandHint: string;
    gwLabel: string;
    dgw: string;
    home: string;
    away: string;
    h2hTitleHome: string;
    h2hTitleAway: string;
    h2hEmptyHome: string;
    h2hEmptyAway: string;
    h2hTapHint: string;
    close: string;
  };
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [selection, setSelection] = useState<FixtureSelection | null>(null);
  const dgwSet = useMemo(() => new Set(dgwKeys), [dgwKeys]);

  const activeBlock = gwBlocks[activeBlockIdx] ?? gwBlocks[0];
  const gwHeaders = useMemo(() => {
    if (!activeBlock) return [];
    return Array.from(
      { length: activeBlock.toGw - activeBlock.fromGw + 1 },
      (_, i) => activeBlock.fromGw + i,
    );
  }, [activeBlock]);

  const openFixture = (
    row: FplFixtureRow,
    fixture: FplFixtureRow["fixtures"][number],
  ) => {
    setSelection({
      team: row.short,
      teamName: row.name,
      opp: fixture.opp,
      oppName: fixture.opp_name,
      home: fixture.home,
      gw: fixture.gw,
    });
  };

  if (rows.length === 0 || !activeBlock) return null;

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {summary}
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h2>
          </div>
          {hint ? (
            <span className="text-xs text-muted-foreground">{hint}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {gwBlocks.map((block, idx) => (
            <button
              key={block.label}
              type="button"
              onClick={() => setActiveBlockIdx(idx)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                idx === activeBlockIdx
                  ? "border-brand-accent/40 bg-brand-accent/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {block.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 md:hidden">
          {rows.map((t) => (
            <TeamRow
              key={t.team_id}
              row={t}
              gwHeaders={gwHeaders}
              dgwKeys={dgwSet}
              expanded={expandedId === t.team_id}
              onToggle={() =>
                setExpandedId(expandedId === t.team_id ? null : t.team_id)
              }
              onSelectFixture={openFixture}
              labels={labels}
            />
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-xl border border-border bg-card/50 md:block">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card px-3 py-3">
                  {labels.team}
                </th>
                {gwHeaders.map((gw) => (
                  <th key={gw} className="px-1.5 py-3 text-center font-medium">
                    GW{gw}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const badge = getFplTeamBadgeStyle(t.short);
                return (
                  <tr
                    key={t.team_id}
                    className="border-t border-border/50 hover:bg-muted/20"
                  >
                    <td className="sticky left-0 z-10 bg-card px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold shadow-sm"
                          style={{
                            background: badge.chipBg,
                            color: badge.color,
                            boxShadow: `inset 0 0 0 1px ${badge.chipBorder}`,
                          }}
                        >
                          {t.short}
                        </span>
                        <span className="font-medium">{t.short}</span>
                      </div>
                    </td>
                    {gwHeaders.map((gw) => {
                      const fs = t.fixtures.filter((x) => x.gw === gw);
                      const isDgw =
                        fs.length >= 2 || dgwSet.has(`${t.team_id}:${gw}`);
                      return (
                        <td key={gw} className="px-1 py-1.5 align-top">
                          {fs.length > 0 ? (
                            <FixtureCell
                              fs={fs}
                              isDgw={isDgw}
                              dgwLabel={labels.dgw}
                              onSelectFixture={(f) => openFixture(t, f)}
                              labels={labels}
                            />
                          ) : (
                            <div className="flex min-h-[3rem] items-center justify-center rounded-lg border border-dashed border-border/40 px-2 py-2 text-center text-xs text-muted-foreground/50">
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <FplFixtureH2hModal
        open={selection != null}
        selection={selection}
        h2hHistory={h2hHistory}
        labels={labels}
        onClose={() => setSelection(null)}
      />
    </>
  );
}
