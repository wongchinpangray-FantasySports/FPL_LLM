"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { PriceChangeRow } from "@/lib/fpl/insights/price-changes";

type Tab = "recent" | "risers" | "fallers" | "volatile";

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

  const sorted = useMemo(() => {
    let list = [...rows];
    if (position !== "all") {
      list = list.filter((r) => r.position === position);
    }
    switch (tab) {
      case "risers":
        return list
          .filter((r) => r.net_change > 0)
          .sort((a, b) => b.net_change - a.net_change);
      case "fallers":
        return list
          .filter((r) => r.net_change < 0)
          .sort((a, b) => a.net_change - b.net_change);
      case "volatile":
        return list.sort((a, b) => b.change_count - a.change_count);
      case "recent":
      default:
        return list.sort((a, b) => {
          const agw = a.last_change?.gw ?? 0;
          const bgw = b.last_change?.gw ?? 0;
          if (bgw !== agw) return bgw - agw;
          return Math.abs(b.last_change?.delta ?? 0) - Math.abs(a.last_change?.delta ?? 0);
        });
    }
  }, [rows, tab, position]);

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
            onClick={() => setTab(t.id)}
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
                <th className="px-3 py-2">{labels.colPlayer}</th>
                <th className="px-3 py-2">{labels.colTeam}</th>
                <th className="px-3 py-2">{labels.colPos}</th>
                <th className="px-3 py-2 text-right">{labels.colPrice}</th>
                <th className="px-3 py-2 text-right">{labels.colNet}</th>
                <th className="px-3 py-2 text-right">{labels.colChanges}</th>
                <th className="px-3 py-2 text-right">{labels.colLastGw}</th>
                <th className="px-3 py-2 text-right">{labels.colLastDelta}</th>
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
