"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { PriceChangeRow } from "@/lib/fpl/insights/price-changes";
import {
  InsightsSortableTh,
  sortInsightRows,
  useInsightsTableSort,
} from "@/components/fpl/insights/insights-table-sort";

type Tab = "recent" | "risers" | "fallers" | "volatile";
type SortKey =
  | "player"
  | "team"
  | "pos"
  | "price"
  | "net"
  | "changes"
  | "lastGw"
  | "lastDelta";

const TAB_SORT: Record<Tab, { key: SortKey; dir: "asc" | "desc" }> = {
  recent: { key: "lastGw", dir: "desc" },
  risers: { key: "net", dir: "desc" },
  fallers: { key: "net", dir: "asc" },
  volatile: { key: "changes", dir: "desc" },
};

function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `£${v.toFixed(1)}m`;
}

function fmtDelta(v: number): string {
  const prefix = v > 0 ? "+" : "";
  return `${prefix}${v.toFixed(1)}`;
}

function deltaClass(v: number): string {
  if (Math.abs(v) < 0.05) return "text-muted-foreground";
  return v > 0 ? "text-emerald-400" : "text-red-400";
}

function priceSortValue(
  row: PriceChangeRow,
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
      return row.current_price;
    case "net":
      return row.net_change;
    case "changes":
      return row.change_count;
    case "lastGw":
      return row.last_change?.gw ?? null;
    case "lastDelta":
    default:
      return row.last_change?.delta ?? null;
  }
}

export function PriceChangesPanel({
  rows,
  gw,
  labels,
}: {
  rows: PriceChangeRow[];
  gw: number;
  labels: {
    intro: string;
    tabRecent: string;
    tabRisers: string;
    tabFallers: string;
    tabVolatile: string;
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
    colNet: string;
    colChanges: string;
    colLastGw: string;
    colLastDelta: string;
    colRecent: string;
    colProfile: string;
    profileLink: string;
    empty: string;
  };
}) {
  const [tab, setTab] = useState<Tab>("recent");
  const [position, setPosition] = useState("all");
  const { sortKey, sortDir, toggle, setSort } = useInsightsTableSort<SortKey>(
    "lastGw",
    "desc",
  );

  const sorted = useMemo(() => {
    let list = [...rows];
    if (position !== "all") {
      list = list.filter((r) => r.position === position);
    }
    switch (tab) {
      case "risers":
        list = list.filter((r) => r.net_change > 0);
        break;
      case "fallers":
        list = list.filter((r) => r.net_change < 0);
        break;
      default:
        break;
    }
    return sortInsightRows(
      list,
      (row) => priceSortValue(row, sortKey),
      sortDir,
    );
  }, [rows, tab, position, sortKey, sortDir]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "recent", label: labels.tabRecent },
    { id: "risers", label: labels.tabRisers },
    { id: "fallers", label: labels.tabFallers },
    { id: "volatile", label: labels.tabVolatile },
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
              const preset = TAB_SORT[t.id];
              setSort(preset.key, preset.dir);
            }}
            className={
              tab === t.id
                ? "rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-brand-accent-foreground"
                : "rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

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
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[880px] text-left text-sm">
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
                  label={labels.colNet}
                  active={sortKey === "net"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("net")}
                />
                <InsightsSortableTh
                  label={labels.colChanges}
                  active={sortKey === "changes"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("changes")}
                />
                <InsightsSortableTh
                  label={labels.colLastGw}
                  active={sortKey === "lastGw"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("lastGw")}
                />
                <InsightsSortableTh
                  label={labels.colLastDelta}
                  active={sortKey === "lastDelta"}
                  dir={sortDir}
                  align="right"
                  onSort={() => toggle("lastDelta")}
                />
                <th className="px-3 py-2">{labels.colRecent}</th>
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
                    {fmtPrice(row.current_price)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-medium ${deltaClass(row.net_change)}`}
                  >
                    {fmtDelta(row.net_change)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.change_count}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({row.rises}↑ {row.falls}↓)
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.last_change ? `GW${row.last_change.gw}` : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${deltaClass(row.last_change?.delta ?? 0)}`}
                  >
                    {row.last_change ? fmtDelta(row.last_change.delta) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.recent_changes.map((c) => (
                        <span
                          key={`${row.fpl_id}-${c.gw}`}
                          className={`rounded-md border border-border px-1.5 py-0.5 text-[10px] tabular-nums ${deltaClass(c.delta)}`}
                          title={`GW${c.gw}: ${fmtPrice(c.from_price)} → ${fmtPrice(c.to_price)}`}
                        >
                          GW{c.gw} {fmtDelta(c.delta)}
                        </span>
                      ))}
                    </div>
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
