"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { PreseasonSignalRow } from "@/lib/fpl/insights/preseason-signals";
import {
  InsightsSortableTh,
  sortInsightRows,
  useInsightsTableSort,
} from "@/components/fpl/insights/insights-table-sort";

type SortKey = "player" | "club" | "goals" | "assists" | "starts" | "subs";

function rowScore(row: PreseasonSignalRow): number {
  return row.goals * 4 + row.assists * 3 + row.starts * 2 + row.sub_appearances;
}

function preseasonSortValue(
  row: PreseasonSignalRow,
  key: SortKey,
): string | number {
  switch (key) {
    case "player":
      return row.name;
    case "club":
      return row.pl_name;
    case "goals":
      return row.goals;
    case "assists":
      return row.assists;
    case "starts":
      return row.starts;
    case "subs":
      return row.sub_appearances;
    default:
      return rowScore(row);
  }
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
  const { sortKey, sortDir, toggle } = useInsightsTableSort<SortKey>("goals");

  const clubs = useMemo(() => {
    const set = new Set(rows.map((r) => r.pl_code));
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let list = club === "all" ? rows : rows.filter((r) => r.pl_code === club);
    return sortInsightRows(
      list,
      (row) => preseasonSortValue(row, sortKey),
      sortDir,
    );
  }, [rows, club, sortKey, sortDir]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {labels.intro.replace("{n}", String(matchCount))}
      </p>

      <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
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

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <InsightsSortableTh
                  label={labels.colPlayer}
                  active={sortKey === "player"}
                  dir={sortDir}
                  onSort={() => toggle("player", "asc")}
                />
                <InsightsSortableTh
                  label={labels.colClub}
                  active={sortKey === "club"}
                  dir={sortDir}
                  onSort={() => toggle("club", "asc")}
                />
                <InsightsSortableTh
                  label={labels.colGoals}
                  active={sortKey === "goals"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("goals")}
                />
                <InsightsSortableTh
                  label={labels.colAssists}
                  active={sortKey === "assists"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("assists")}
                />
                <InsightsSortableTh
                  label={labels.colStarts}
                  active={sortKey === "starts"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("starts")}
                />
                <InsightsSortableTh
                  label={labels.colSubs}
                  active={sortKey === "subs"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("subs")}
                />
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
