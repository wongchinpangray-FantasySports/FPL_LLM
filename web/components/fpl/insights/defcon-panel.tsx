"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { DefconRow } from "@/lib/fpl/insights/defcon";
import { DEFAULT_DEFCON_MIN_MINUTES } from "@/lib/fpl/insights/defcon";
import {
  InsightsSortableTh,
  sortInsightRows,
  useInsightsTableSort,
} from "@/components/fpl/insights/insights-table-sort";

type SortKey =
  | "player"
  | "team"
  | "pos"
  | "defcon"
  | "dcPts"
  | "defcon90"
  | "cbi"
  | "rec"
  | "tkl"
  | "minutes";

function fmtNum(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

function defconSortValue(row: DefconRow, key: SortKey): string | number | null {
  switch (key) {
    case "player":
      return row.web_name;
    case "team":
      return row.team;
    case "pos":
      return row.position;
    case "dcPts":
      return row.dc_points;
    case "defcon90":
      return row.defensive_contribution_per_90;
    case "cbi":
      return row.cbi;
    case "rec":
      return row.recoveries;
    case "tkl":
      return row.tackles;
    case "minutes":
      return row.minutes;
    case "defcon":
    default:
      return row.defensive_contribution;
  }
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
    colPlayer: string;
    colTeam: string;
    colPos: string;
    colDefcon: string;
    colDcPts: string;
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
  const { sortKey, sortDir, toggle } = useInsightsTableSort<SortKey>("defcon");

  const filtered = useMemo(() => {
    let list = rows.filter((r) => r.minutes >= minMinutes);
    if (position !== "all") {
      list = list.filter((r) => r.position === position);
    }
    return sortInsightRows(list, (row) => defconSortValue(row, sortKey), sortDir);
  }, [rows, position, minMinutes, sortKey, sortDir]);

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
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <InsightsSortableTh
                  label={labels.colPlayer}
                  active={sortKey === "player"}
                  dir={sortDir}
                  onSort={() => toggle("player", "asc")}
                />
                <InsightsSortableTh
                  label={labels.colTeam}
                  active={sortKey === "team"}
                  dir={sortDir}
                  onSort={() => toggle("team", "asc")}
                />
                <InsightsSortableTh
                  label={labels.colPos}
                  active={sortKey === "pos"}
                  dir={sortDir}
                  onSort={() => toggle("pos", "asc")}
                />
                <InsightsSortableTh
                  label={labels.colDefcon}
                  active={sortKey === "defcon"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("defcon")}
                />
                <InsightsSortableTh
                  label={labels.colDcPts}
                  active={sortKey === "dcPts"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("dcPts")}
                />
                <InsightsSortableTh
                  label={labels.colDefcon90}
                  active={sortKey === "defcon90"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("defcon90")}
                />
                <InsightsSortableTh
                  label={labels.colCbi}
                  active={sortKey === "cbi"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("cbi")}
                />
                <InsightsSortableTh
                  label={labels.colRec}
                  active={sortKey === "rec"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("rec")}
                />
                <InsightsSortableTh
                  label={labels.colTkl}
                  active={sortKey === "tkl"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("tkl")}
                />
                <InsightsSortableTh
                  label={labels.colMins}
                  active={sortKey === "minutes"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("minutes")}
                />
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
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                    {row.dc_points}
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
