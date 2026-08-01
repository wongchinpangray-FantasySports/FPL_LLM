"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { TransferRow } from "@/lib/fpl/insights/transfers";

type Tab = "net" | "in" | "out" | "ownership";

function fmtNum(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

function fmtInt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}m`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
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

  const sorted = useMemo(() => {
    let list = [...rows];
    if (position !== "all") {
      list = list.filter((r) => r.position === position);
    }
    switch (tab) {
      case "in":
        return list.sort((a, b) => b.transfers_in - a.transfers_in);
      case "out":
        return list.sort((a, b) => b.transfers_out - a.transfers_out);
      case "ownership":
        return list.sort(
          (a, b) => (b.ownership_delta ?? -999) - (a.ownership_delta ?? -999),
        );
      case "net":
      default:
        return list.sort((a, b) => b.net_transfers - a.net_transfers);
    }
  }, [rows, tab, position]);

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
            onClick={() => setTab(t.id)}
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
                <th className="px-3 py-2">{labels.colPlayer}</th>
                <th className="px-3 py-2">{labels.colTeam}</th>
                <th className="px-3 py-2">{labels.colPos}</th>
                <th className="px-3 py-2 text-right">{labels.colPrice}</th>
                <th className="px-3 py-2 text-right">{labels.colOwn}</th>
                <th className="px-3 py-2 text-right">{labels.colOwnDelta}</th>
                <th className="px-3 py-2 text-right">{labels.colIn}</th>
                <th className="px-3 py-2 text-right">{labels.colOut}</th>
                <th className="px-3 py-2 text-right">{labels.colNet}</th>
                <th className="px-3 py-2">{labels.colProfile}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 80).map((row) => (
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
