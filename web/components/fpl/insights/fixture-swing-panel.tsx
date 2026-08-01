"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { fdrClass, normalizeFplFdr, type FplFdrLevel } from "@/lib/fpl/fdr";
import { FplFdrLegend } from "@/components/fpl/fpl-fdr-legend";
import { getFplTeamBadgeStyle } from "@/lib/team-themes";
import type { FixtureSwingRow } from "@/lib/fpl/insights/fixture-swing";

type SortKey = "easiest" | "hardest";

function FixtureChip({
  fx,
  homeLabel,
  awayLabel,
}: {
  fx: FixtureSwingRow["fixtures"][number];
  homeLabel: string;
  awayLabel: string;
}) {
  const oppBadge = getFplTeamBadgeStyle(fx.opp);
  return (
    <span
      className={cn(
        "inline-flex min-w-[3.25rem] flex-col items-center rounded-md border px-1.5 py-1 text-[10px] font-semibold tabular-nums",
        fdrClass(fx.fdr),
      )}
      title={`GW${fx.gw} · ${fx.home ? homeLabel : awayLabel} · FDR ${normalizeFplFdr(fx.fdr) ?? fx.fdr}`}
    >
      <span
        className="rounded px-1 text-[9px] font-bold"
        style={{ background: oppBadge.chipBg, color: oppBadge.color }}
      >
        {fx.opp}
      </span>
      <span className="mt-0.5 opacity-90">
        {normalizeFplFdr(fx.fdr) ?? fx.fdr}
      </span>
    </span>
  );
}

export function FixtureSwingPanel({
  rows,
  fromGw,
  defaultHorizon,
  labels,
}: {
  rows: FixtureSwingRow[];
  fromGw: number;
  defaultHorizon: number;
  labels: {
    intro: string;
    horizon: string;
    horizon5: string;
    horizon8: string;
    sortBy: string;
    sortEasiest: string;
    sortHardest: string;
    colTeam: string;
    colAvgFdr: string;
    colFixtures: string;
    colRuns: string;
    empty: string;
    fdrLegend: Record<FplFdrLevel, string>;
    home: string;
    away: string;
  };
}) {
  const [horizon, setHorizon] = useState(defaultHorizon);
  const [sort, setSort] = useState<SortKey>("easiest");

  const displayed = useMemo(() => {
    const list = rows.map((row) => {
      const fixtures = row.fixtures.slice(0, horizon);
      const total = fixtures.reduce((sum, fx) => sum + fx.fdr, 0);
      const avg =
        fixtures.length > 0
          ? Math.round((total / fixtures.length) * 100) / 100
          : row.avg_fdr;
      return { ...row, fixtures, avg_fdr: avg, total_fdr: total };
    });

    return [...list].sort((a, b) =>
      sort === "hardest" ? b.avg_fdr - a.avg_fdr : a.avg_fdr - b.avg_fdr,
    );
  }, [rows, horizon, sort]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {labels.intro.replace("{fromGw}", String(fromGw)).replace("{horizon}", String(horizon))}
      </p>

      <FplFdrLegend labels={labels.fdrLegend} />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {labels.horizon}
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
          >
            <option value={5}>{labels.horizon5}</option>
            <option value={8}>{labels.horizon8}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {labels.sortBy}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
          >
            <option value="easiest">{labels.sortEasiest}</option>
            <option value="hardest">{labels.sortHardest}</option>
          </select>
        </label>
      </div>

      {displayed.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">{labels.colTeam}</th>
                <th className="px-3 py-2 text-right">{labels.colAvgFdr}</th>
                <th className="px-3 py-2">{labels.colFixtures}</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((row) => {
                const badge = getFplTeamBadgeStyle(row.short);
                return (
                  <tr
                    key={row.team_id}
                    className="border-b border-border/60 hover:bg-card/50"
                  >
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2 font-medium text-foreground">
                        <span
                          className="rounded-md px-1.5 py-0.5 text-xs font-bold"
                          style={{
                            background: badge.chipBg,
                            color: badge.color,
                          }}
                        >
                          {row.short}
                        </span>
                        {row.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={cn(
                          "inline-flex min-w-[2rem] justify-center rounded-md border px-2 py-0.5 font-semibold tabular-nums",
                          fdrClass(row.avg_fdr),
                        )}
                      >
                        {row.avg_fdr.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {row.fixtures.map((fx) => (
                          <FixtureChip
                            key={`${row.team_id}-${fx.gw}`}
                            fx={fx}
                            homeLabel={labels.home}
                            awayLabel={labels.away}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
