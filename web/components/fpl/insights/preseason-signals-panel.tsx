"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { PreseasonSignalRow } from "@/lib/fpl/insights/preseason-signals";

type SortKey = "score" | "goals" | "assists" | "starts";

function rowScore(row: PreseasonSignalRow): number {
  return row.goals * 4 + row.assists * 3 + row.starts * 2 + row.sub_appearances;
}

export function PreseasonSignalsPanel({
  rows,
  matchCount,
  labels,
}: {
  rows: PreseasonSignalRow[];
  matchCount: number;
  labels: {
    intro: string;
    filterClub: string;
    filterAll: string;
    sortBy: string;
    colPlayer: string;
    colClub: string;
    colGoals: string;
    colAssists: string;
    colStarts: string;
    colSubs: string;
    colFpl: string;
    fplLink: string;
    noFpl: string;
    empty: string;
    matchNote: string;
  };
}) {
  const [club, setClub] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("score");

  const clubs = useMemo(() => {
    const set = new Set(rows.map((r) => r.pl_code));
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let list = club === "all" ? rows : rows.filter((r) => r.pl_code === club);
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "goals":
          return b.goals - a.goals || b.assists - a.assists;
        case "assists":
          return b.assists - a.assists || b.goals - a.goals;
        case "starts":
          return b.starts - a.starts || b.goals - a.goals;
        case "score":
        default:
          return rowScore(b) - rowScore(a);
      }
    });
    return list;
  }, [rows, club, sort]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {labels.intro.replace("{n}", String(matchCount))}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {labels.filterClub}
          <select
            value={club}
            onChange={(e) => setClub(e.target.value)}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
          >
            <option value="all">{labels.filterAll}</option>
            {clubs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {labels.sortBy}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
          >
            <option value="score">{labels.colGoals} + form</option>
            <option value="goals">{labels.colGoals}</option>
            <option value="assists">{labels.colAssists}</option>
            <option value="starts">{labels.colStarts}</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">{labels.colPlayer}</th>
                <th className="px-3 py-2">{labels.colClub}</th>
                <th className="px-3 py-2 text-right">{labels.colGoals}</th>
                <th className="px-3 py-2 text-right">{labels.colAssists}</th>
                <th className="px-3 py-2 text-right">{labels.colStarts}</th>
                <th className="px-3 py-2 text-right">{labels.colSubs}</th>
                <th className="px-3 py-2">{labels.colFpl}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b border-border/60 hover:bg-card/50",
                    row.fpl_id && "cursor-pointer",
                  )}
                >
                  <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.pl_name}{" "}
                    <span className="text-xs">({row.pl_code})</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.goals}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.assists}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.starts}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.sub_appearances}</td>
                  <td className="px-3 py-2">
                    {row.fpl_id ? (
                      <Link
                        href={`/player/${row.fpl_id}`}
                        className="text-brand-accent no-underline hover:underline"
                      >
                        {labels.fplLink}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">{labels.noFpl}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{labels.matchNote}</p>
    </div>
  );
}
