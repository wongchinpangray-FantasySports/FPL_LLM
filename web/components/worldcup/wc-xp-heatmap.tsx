"use client";

import { cn } from "@/lib/utils";
import { xpCellClass } from "@/components/xp-heatmap";
import type { WcXpRow } from "@/lib/wc/data";

export function WcXpHeatmap({
  rows,
  matchdays,
  title,
  hint,
  labels,
  positionFilter,
  onPositionChange,
  positionOptions,
}: {
  rows: WcXpRow[];
  matchdays: number[];
  title: string;
  hint: string;
  labels: {
    player: string;
    team: string;
    pos: string;
    total: string;
    filter: string;
  };
  positionFilter: string;
  onPositionChange: (pos: string) => void;
  positionOptions: { value: string; label: string }[];
}) {
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">
            {title}
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
            {hint}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <span>{labels.filter}</span>
          <select
            value={positionFilter}
            onChange={(e) => onPositionChange(e.target.value)}
            className="rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 text-sm text-white"
          >
            {positionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] sm:rounded-2xl">
        <table className="w-full text-[11px] sm:text-xs">
          <thead>
            <tr className="text-left text-[9px] uppercase text-slate-400 sm:text-[10px]">
              <th className="px-2 py-1.5 sm:px-3 sm:py-2">{labels.player}</th>
              <th className="px-1.5 py-1.5 sm:px-2 sm:py-2">{labels.team}</th>
              <th className="px-1.5 py-1.5 sm:px-2 sm:py-2">{labels.pos}</th>
              {matchdays.map((md) => (
                <th key={md} className="px-1 py-1.5 text-center sm:px-2 sm:py-2">
                  MD{md}
                </th>
              ))}
              <th className="px-1.5 py-1.5 text-right sm:px-2 sm:py-2">
                {labels.total}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-2 py-1.5 font-medium sm:px-3 sm:py-2">{r.name}</td>
                <td className="px-1.5 py-1.5 text-slate-300 sm:px-2 sm:py-2">
                  {r.team_code}
                </td>
                <td className="px-1.5 py-1.5 text-slate-400 sm:px-2 sm:py-2">
                  {r.position}
                </td>
                {matchdays.map((md) => {
                  const cell = r.byMd[md];
                  const xp = cell?.xp ?? 0;
                  return (
                    <td key={md} className="px-0.5 py-0.5 align-middle sm:px-1 sm:py-1">
                      {cell ? (
                        <div
                          className={cn(
                            "rounded px-1 py-0.5 text-center text-[10px] leading-tight sm:px-1.5 sm:py-1 sm:text-[11px]",
                            xpCellClass(xp),
                          )}
                          title={`${cell.opp}${cell.home ? " (H)" : " (A)"} · FDR ${cell.fdr} · xP ${xp.toFixed(2)}`}
                        >
                          <div className="font-semibold">{xp.toFixed(1)}</div>
                          <div className="text-[9px] opacity-80">
                            {cell.opp}
                            {!cell.home ? "·A" : ""}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded border border-white/5 bg-slate-900/40 px-1 py-0.5 text-center text-slate-600">
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-1.5 py-1.5 text-right font-semibold sm:px-2 sm:py-2">
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
