"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { XgDivergenceRow } from "@/lib/fpl/insights/xg-divergence";
import { DEFAULT_XG_DIVERGENCE_MIN_MINUTES } from "@/lib/fpl/insights/xg-divergence";

type SortKey =
  | "fpl_under"
  | "fpl_over"
  | "us_under"
  | "fpl_vs_us";

function fmtNum(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const prefix = v > 0 ? "+" : "";
  return `${prefix}${v.toFixed(d)}`;
}

function deltaClass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || Math.abs(v) < 0.05) {
    return "text-muted-foreground";
  }
  return v > 0 ? "text-emerald-400" : "text-red-400";
}

export function XgDivergencePanel({
  rows,
  minMinutes,
  labels,
}: {
  rows: XgDivergenceRow[];
  minMinutes: number;
  labels: {
    intro: string;
    filterPos: string;
    posAll: string;
    posDef: string;
    posMid: string;
    posFwd: string;
    minMinutes: string;
    sortBy: string;
    sortFplUnder: string;
    sortFplOver: string;
    sortUsUnder: string;
    sortFplVsUs: string;
    colPlayer: string;
    colTeam: string;
    colPos: string;
    colMins: string;
    colGoals: string;
    colFplXg: string;
    colUsXg: string;
    colFplDelta: string;
    colUsDelta: string;
    colFplUs: string;
    colProfile: string;
    profileLink: string;
    empty: string;
    deltaHint: string;
  };
}) {
  const [position, setPosition] = useState("all");
  const [minMins, setMinMins] = useState(minMinutes);
  const [sort, setSort] = useState<SortKey>("fpl_under");

  const filtered = useMemo(() => {
    let list = rows.filter((r) => r.minutes >= minMins);
    if (position !== "all") {
      list = list.filter((r) => r.position === position);
    }
    return [...list].sort((a, b) => {
      switch (sort) {
        case "fpl_over":
          return a.fpl_vs_actual - b.fpl_vs_actual;
        case "us_under":
          return (
            (b.understat_vs_actual ?? -999) - (a.understat_vs_actual ?? -999)
          );
        case "fpl_vs_us":
          return (
            Math.abs(b.fpl_vs_understat ?? 0) -
            Math.abs(a.fpl_vs_understat ?? 0)
          );
        case "fpl_under":
        default:
          return b.fpl_vs_actual - a.fpl_vs_actual;
      }
    });
  }, [rows, position, minMins, sort]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{labels.intro}</p>
      <p className="text-xs text-muted-foreground">{labels.deltaHint}</p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {labels.filterPos}
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
          >
            <option value="all">{labels.posAll}</option>
            <option value="DEF">{labels.posDef}</option>
            <option value="MID">{labels.posMid}</option>
            <option value="FWD">{labels.posFwd}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {labels.minMinutes}
          <select
            value={minMins}
            onChange={(e) => setMinMins(Number(e.target.value))}
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
            <option value="fpl_under">{labels.sortFplUnder}</option>
            <option value="fpl_over">{labels.sortFplOver}</option>
            <option value="us_under">{labels.sortUsUnder}</option>
            <option value="fpl_vs_us">{labels.sortFplVsUs}</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">{labels.colPlayer}</th>
                <th className="px-3 py-2">{labels.colTeam}</th>
                <th className="px-3 py-2">{labels.colPos}</th>
                <th className="px-3 py-2 text-right">{labels.colMins}</th>
                <th className="px-3 py-2 text-right">{labels.colGoals}</th>
                <th className="px-3 py-2 text-right">{labels.colFplXg}</th>
                <th className="px-3 py-2 text-right">{labels.colUsXg}</th>
                <th className="px-3 py-2 text-right">{labels.colFplDelta}</th>
                <th className="px-3 py-2 text-right">{labels.colUsDelta}</th>
                <th className="px-3 py-2 text-right">{labels.colFplUs}</th>
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
                    {row.minutes}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.goals}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.fpl_xg.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.understat_xg != null
                      ? row.understat_xg.toFixed(2)
                      : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-medium ${deltaClass(row.fpl_vs_actual)}`}
                  >
                    {fmtNum(row.fpl_vs_actual)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${deltaClass(row.understat_vs_actual)}`}
                  >
                    {fmtNum(row.understat_vs_actual)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${deltaClass(row.fpl_vs_understat)}`}
                  >
                    {fmtNum(row.fpl_vs_understat)}
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
