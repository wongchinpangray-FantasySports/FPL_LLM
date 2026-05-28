"use client";

import { cn } from "@/lib/utils";
import { fdrClass } from "@/lib/wc/fdr";
import type { WcFdrRow } from "@/lib/wc/data";

export function WcFdrGrid({
  rows,
  matchdays,
  title,
  hint,
  labels,
}: {
  rows: WcFdrRow[];
  matchdays: number[];
  title: string;
  hint: string;
  labels: { team: string; group: string };
}) {
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">
          {title}
        </h2>
        <span className="max-w-xl text-xs leading-relaxed text-slate-400">
          {hint}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] sm:rounded-2xl">
        <table className="w-full text-[11px] sm:text-xs">
          <thead>
            <tr className="text-left text-[9px] uppercase text-slate-400 sm:text-[10px]">
              <th className="px-2 py-1.5 sm:px-3 sm:py-2">{labels.team}</th>
              <th className="px-1.5 py-1.5 sm:px-2 sm:py-2">{labels.group}</th>
              {matchdays.map((md) => (
                <th key={md} className="px-1 py-1.5 text-center sm:px-2 sm:py-2">
                  MD{md}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.team_id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-2 py-1.5 font-medium sm:px-3 sm:py-2">
                  {t.name}
                </td>
                <td className="px-1.5 py-1.5 text-slate-400 sm:px-2 sm:py-2">
                  {t.group_letter}
                </td>
                {matchdays.map((md) => {
                  const f = t.fixtures.find((x) => x.matchday === md);
                  return (
                    <td key={md} className="px-0.5 py-0.5 align-middle sm:px-1 sm:py-1">
                      {f ? (
                        <div
                          className={cn(
                            "rounded border px-1 py-0.5 text-center sm:px-1.5 sm:py-1",
                            fdrClass(f.fdr),
                          )}
                          title={`FDR ${f.fdr} vs ${f.opp_name}${f.home ? " (H)" : " (A)"}`}
                        >
                          <div className="font-semibold">
                            {f.opp_name}
                            {!f.home ? " (A)" : ""}
                          </div>
                          <div className="text-[9px] opacity-80">FDR {f.fdr}</div>
                        </div>
                      ) : (
                        <div className="rounded border border-white/5 bg-slate-900/40 px-1 py-0.5 text-center text-slate-600">
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
