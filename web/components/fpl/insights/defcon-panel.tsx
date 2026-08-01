"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { DefconRow } from "@/lib/fpl/insights/defcon";
import { DEFAULT_DEFCON_MIN_MINUTES } from "@/lib/fpl/insights/defcon";

type SortKey = "defcon" | "defcon90" | "cbi" | "minutes";

function fmtNum(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

export function DefconPanel({
  rows,
  labels,
}: {
  rows: DefconRow[];
  labels: {
    intro: string;
    filterPos: string;
    posAll: string;
    posGkp: string;
    posDef: string;
    posMid: string;
    posFwd: string;
    minMinutes: string;
    sortBy: string;
    colPlayer: string;
    colTeam: string;
    colPos: string;
    colDefcon: string;
    colDefcon90: string;
    colCbi: string;
    colRec: string;
    colTkl: string;
    colMins: string;
    colProfile: string;
    profileLink: string;
    empty: string;
  };
}) {
  const [position, setPosition] = useState<string>("all");
  const [minMinutes, setMinMinutes] = useState(DEFAULT_DEFCON_MIN_MINUTES);
  const [sort, setSort] = useState<SortKey>("defcon");

  const filtered = useMemo(() => {
    let list = rows.filter((r) => r.minutes >= minMinutes);
    if (position !== "all") {
      list = list.filter((r) => r.position === position);
    }
    return [...list].sort((a, b) => {
      switch (sort) {
        case "defcon90":
          return (
            (b.defensive_contribution_per_90 ?? 0) -
            (a.defensive_contribution_per_90 ?? 0)
          );
        case "cbi":
          return (b.cbi ?? 0) - (a.cbi ?? 0);
        case "minutes":
          return b.minutes - a.minutes;
        case "defcon":
        default:
          return b.defensive_contribution - a.defensive_contribution;
      }
    });
  }, [rows, position, minMinutes, sort]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{labels.intro}</p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
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
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {labels.minMinutes}
          <select
            value={minMinutes}
            onChange={(e) => setMinMinutes(Number(e.target.value))}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
          >
            <option value={0}>0</option>
            <option value={270}>270</option>
            <option value={450}>450</option>
            <option value={900}>900</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {labels.sortBy}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
          >
            <option value="defcon">{labels.colDefcon}</option>
            <option value="defcon90">{labels.colDefcon90}</option>
            <option value="cbi">{labels.colCbi}</option>
            <option value="minutes">{labels.colMins}</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">{labels.colPlayer}</th>
                <th className="px-3 py-2">{labels.colTeam}</th>
                <th className="px-3 py-2">{labels.colPos}</th>
                <th className="px-3 py-2 text-right">{labels.colDefcon}</th>
                <th className="px-3 py-2 text-right">{labels.colDefcon90}</th>
                <th className="px-3 py-2 text-right">{labels.colCbi}</th>
                <th className="px-3 py-2 text-right">{labels.colRec}</th>
                <th className="px-3 py-2 text-right">{labels.colTkl}</th>
                <th className="px-3 py-2 text-right">{labels.colMins}</th>
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
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-brand-accent">
                    {row.defensive_contribution}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNum(row.defensive_contribution_per_90, 2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.cbi ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.recoveries ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.tackles ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.minutes}
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
