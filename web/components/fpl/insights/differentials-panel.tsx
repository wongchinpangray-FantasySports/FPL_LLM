"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { DifferentialRow } from "@/lib/fpl/insights/differentials";
import { DEFAULT_DIFFERENTIALS_MAX_OWNERSHIP } from "@/lib/fpl/insights/catalog";

function fmtNum(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

export function DifferentialsPanel({
  rows,
  horizon,
  maxOwnership,
  labels,
}: {
  rows: DifferentialRow[];
  horizon: number;
  maxOwnership: number;
  labels: {
    intro: string;
    filterPos: string;
    posAll: string;
    posGkp: string;
    posDef: string;
    posMid: string;
    posFwd: string;
    colPlayer: string;
    colTeam: string;
    colPos: string;
    colPrice: string;
    colOwn: string;
    colForm: string;
    colXp: string;
    colXpGw: string;
    colValue: string;
    colFixtures: string;
    colProfile: string;
    profileLink: string;
    empty: string;
    fixtureHome: string;
    fixtureAway: string;
  };
}) {
  const [position, setPosition] = useState("all");

  const filtered = useMemo(() => {
    if (position === "all") return rows;
    return rows.filter((r) => r.position === position);
  }, [rows, position]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {labels.intro
          .replace("{own}", String(maxOwnership))
          .replace("{horizon}", String(horizon))}
      </p>

      <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
        {labels.filterPos}
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
        >
          <option value="all">{labels.posAll}</option>
          <option value="GKP">{labels.posGkp}</option>
          <option value="DEF">{labels.posDef}</option>
          <option value="MID">{labels.posMid}</option>
          <option value="FWD">{labels.posFwd}</option>
        </select>
      </label>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">{labels.colPlayer}</th>
                <th className="px-3 py-2">{labels.colTeam}</th>
                <th className="px-3 py-2">{labels.colPos}</th>
                <th className="px-3 py-2 text-right">{labels.colPrice}</th>
                <th className="px-3 py-2 text-right">{labels.colOwn}</th>
                <th className="px-3 py-2 text-right">{labels.colForm}</th>
                <th className="px-3 py-2 text-right">{labels.colXp}</th>
                <th className="px-3 py-2 text-right">{labels.colXpGw}</th>
                <th className="px-3 py-2 text-right">{labels.colValue}</th>
                <th className="px-3 py-2">{labels.colFixtures}</th>
                <th className="px-3 py-2">{labels.colProfile}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.fpl_id}
                  className="border-b border-border/60 hover:bg-card/50"
                >
                  <td className="px-3 py-2 font-medium text-foreground">
                    {row.web_name}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.team}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.position ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    £{fmtNum(row.price)}m
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNum(row.ownership)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNum(row.form)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-brand-accent">
                    {fmtNum(row.xp_total, 1)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNum(row.xp_per_game, 1)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNum(row.value_per_million, 2)}
                  </td>
                  <td className="max-w-[220px] px-3 py-2 text-xs text-muted-foreground">
                    {row.fixtures
                      .slice(0, 5)
                      .map((f) => {
                        const ha = f.home ? "H" : "A";
                        return `GW${f.gw} ${f.opp} (${ha}) ${fmtNum(f.xp, 1)}`;
                      })
                      .join(" · ")}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/player/${row.fpl_id}`}
                      className="text-brand-accent no-underline hover:underline"
                    >
                      {labels.profileLink}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_DIFFERENTIALS_MAX_OWNERSHIP };
