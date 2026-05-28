"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { xpCellClass } from "@/components/xp-heatmap";
import type { WcXpRow } from "@/lib/wc/data";
import {
  WcPlayerNameRow,
  WcSectionIntro,
  WcStatChip,
} from "@/components/worldcup/wc-shared";

function XpPlayerCard({
  row,
  matchdays,
  expanded,
  onToggle,
  labels,
}: {
  row: WcXpRow;
  matchdays: number[];
  expanded: boolean;
  onToggle: () => void;
  labels: {
    team: string;
    pos: string;
    total: string;
    expandHint: string;
    copyName: string;
    copiedName: string;
    mdLabel: string;
  };
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "cursor-pointer rounded-lg border p-3 transition-colors",
        expanded
          ? "border-brand-accent/30 bg-white/[0.05]"
          : "border-white/[0.06] bg-slate-950/40 hover:border-white/12",
      )}
    >
      <WcPlayerNameRow
        name={row.name}
        copyLabel={labels.copyName}
        copiedLabel={labels.copiedName}
      />
      <p className="mt-1 text-xs text-slate-500">
        {row.team_name} · {row.position}
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <WcStatChip label={labels.total} value={row.xp_total.toFixed(1)} accent />
        {!expanded ? (
          <span className="text-[10px] text-slate-600">{labels.expandHint}</span>
        ) : null}
      </div>
      {expanded ? (
        <div
          className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-3"
          onClick={(e) => e.stopPropagation()}
        >
          {matchdays.map((md) => {
            const cell = row.byMd[md];
            const xp = cell?.xp ?? 0;
            return (
              <div
                key={md}
                className={cn(
                  "rounded-md px-2 py-1.5 text-center text-xs",
                  cell ? xpCellClass(xp) : "border border-white/5 bg-slate-900/40",
                )}
              >
                <div className="text-[9px] font-medium uppercase text-slate-500">
                  {labels.mdLabel}
                  {md}
                </div>
                <div className="font-semibold tabular-nums">
                  {cell ? xp.toFixed(1) : "—"}
                </div>
                {cell ? (
                  <div className="mt-0.5 text-[10px] opacity-90">
                    {cell.opp_name}
                    {cell.home ? "" : " · A"}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

export function WcXpHeatmap({
  rows,
  matchdays,
  title,
  summary,
  detail,
  moreLabel,
  labels,
  positionFilter,
  onPositionChange,
  positionOptions,
}: {
  rows: WcXpRow[];
  matchdays: number[];
  title: string;
  summary?: string;
  detail?: string;
  moreLabel?: string;
  labels: {
    player: string;
    team: string;
    pos: string;
    total: string;
    filter: string;
    expandHint: string;
    copyName: string;
    copiedName: string;
    mdLabel: string;
  };
  positionFilter: string;
  onPositionChange: (pos: string) => void;
  positionOptions: { value: string; label: string }[];
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <WcSectionIntro
          title={title}
          summary={summary}
          detail={detail}
          moreLabel={moreLabel}
        />
        <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
          <span>{labels.filter}</span>
          <select
            value={positionFilter}
            onChange={(e) => onPositionChange(e.target.value)}
            className="rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-sm text-white"
          >
            {positionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => (
          <XpPlayerCard
            key={r.id}
            row={r}
            matchdays={matchdays}
            expanded={expandedId === r.id}
            onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
            labels={{
              team: labels.team,
              pos: labels.pos,
              total: labels.total,
              expandHint: labels.expandHint,
              copyName: labels.copyName,
              copiedName: labels.copiedName,
              mdLabel: labels.mdLabel,
            }}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] md:block">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase text-slate-500">
              <th className="min-w-[140px] px-3 py-2">{labels.player}</th>
              <th className="px-2 py-2">{labels.team}</th>
              <th className="px-2 py-2">{labels.pos}</th>
              {matchdays.map((md) => (
                <th key={md} className="px-2 py-2 text-center">
                  MD{md}
                </th>
              ))}
              <th className="px-2 py-2 text-right">{labels.total}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-t border-white/5 hover:bg-white/[0.03]"
              >
                <td className="max-w-[200px] px-3 py-2 align-top">
                  <WcPlayerNameRow
                    name={r.name}
                    copyLabel={labels.copyName}
                    copiedLabel={labels.copiedName}
                  />
                </td>
                <td className="px-2 py-2 text-slate-400">{r.team_name}</td>
                <td className="px-2 py-2 text-slate-500">{r.position}</td>
                {matchdays.map((md) => {
                  const cell = r.byMd[md];
                  const xp = cell?.xp ?? 0;
                  return (
                    <td key={md} className="px-1 py-1 align-middle">
                      {cell ? (
                        <div
                          className={cn(
                            "rounded px-1.5 py-1 text-center tabular-nums",
                            xpCellClass(xp),
                          )}
                          title={`${cell.opp_name}${cell.home ? " (H)" : " (A)"} · FDR ${cell.fdr}`}
                        >
                          {xp.toFixed(1)}
                        </div>
                      ) : (
                        <div className="rounded border border-white/5 px-1.5 py-1 text-center text-slate-600">
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-right font-semibold tabular-nums text-brand-accent">
                  {r.xp_total.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
