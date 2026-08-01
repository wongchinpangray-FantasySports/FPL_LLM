"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { TransferRow } from "@/lib/fpl/insights/transfers";
import {
  InsightsSortableTh,
  sortInsightRows,
  useInsightsTableSort,
} from "@/components/fpl/insights/insights-table-sort";

type Tab = "net" | "in" | "out" | "ownership";
type SortKey =
  | "player"
  | "team"
  | "pos"
  | "price"
  | "own"
  | "ownDelta"
  | "in"
  | "out"
  | "net";

const TAB_SORT: Record<Tab, SortKey> = {
  net: "net",
  in: "in",
  out: "out",
  ownership: "ownDelta",
};

function fmtNum(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

function fmtInt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}m`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

function transferSortValue(
  row: TransferRow,
  key: SortKey,
): string | number | null {
  switch (key) {
    case "player":
      return row.web_name;
    case "team":
      return row.team;
    case "pos":
      return row.position;
    case "price":
      return row.base_price;
    case "own":
      return row.selected_by_percent;
    case "ownDelta":
      return row.ownership_delta;
    case "in":
      return row.transfers_in;
    case "out":
      return row.transfers_out;
    case "net":
    default:
      return row.net_transfers;
  }
}

export function TransfersPanel({
  rows,
  gw,
  labels,
}: {
  rows: TransferRow[];
  gw: number;
  labels: {
    intro: string;
    tabNet: string;
    tabIn: string;
    tabOut: string;
    tabOwnership: string;
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
    colOwnDelta: string;
    colIn: string;
    colOut: string;
    colNet: string;
    colProfile: string;
    profileLink: string;
    empty: string;
  };
}) {
  const [tab, setTab] = useState<Tab>("net");
  const [position, setPosition] = useState("all");
  const { sortKey, sortDir, toggle, setSort } = useInsightsTableSort<SortKey>("net");

  const sorted = useMemo(() => {
    let list = [...rows];
    if (position !== "all") {
      list = list.filter((r) => r.position === position);
    }
    return sortInsightRows(
      list,
      (row) => transferSortValue(row, sortKey),
      sortDir,
    );
  }, [rows, position, sortKey, sortDir]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "net", label: labels.tabNet },
    { id: "in", label: labels.tabIn },
    { id: "out", label: labels.tabOut },
    { id: "ownership", label: labels.tabOwnership },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {labels.intro.replace("{gw}", String(gw))}
      </p>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSort(TAB_SORT[t.id], "desc");
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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

      {sorted.length === 0 ? (
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
                  label={labels.colPrice}
                  active={sortKey === "price"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("price")}
                />
                <InsightsSortableTh
                  label={labels.colOwn}
                  active={sortKey === "own"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("own")}
                />
                <InsightsSortableTh
                  label={labels.colOwnDelta}
                  active={sortKey === "ownDelta"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("ownDelta")}
                />
                <InsightsSortableTh
                  label={labels.colIn}
                  active={sortKey === "in"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("in")}
                />
                <InsightsSortableTh
                  label={labels.colOut}
                  active={sortKey === "out"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("out")}
                />
                <InsightsSortableTh
                  label={labels.colNet}
                  active={sortKey === "net"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("net")}
                />
                <th className="px-3 py-2">{labels.colProfile}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
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
                    £{fmtNum(row.base_price)}m
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNum(row.selected_by_percent)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.ownership_delta != null
                      ? `${row.ownership_delta >= 0 ? "+" : ""}${fmtNum(row.ownership_delta, 2)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-400/90">
                    {fmtInt(row.transfers_in)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-400/80">
                    {fmtInt(row.transfers_out)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold tabular-nums ${
                      row.net_transfers >= 0
                        ? "text-brand-accent"
                        : "text-red-400/90"
                    }`}
                  >
                    {row.net_transfers >= 0 ? "+" : ""}
                    {fmtInt(row.net_transfers)}
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
