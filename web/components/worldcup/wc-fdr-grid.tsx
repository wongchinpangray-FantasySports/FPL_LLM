"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { fdrClass } from "@/lib/wc/fdr";
import type { WcFdrRow } from "@/lib/wc/data";
import { WcSectionIntro } from "@/components/worldcup/wc-shared";

function TeamRow({
  row,
  matchdays,
  expanded,
  onToggle,
  labels,
}: {
  row: WcFdrRow;
  matchdays: number[];
  expanded: boolean;
  onToggle: () => void;
  labels: { group: string; expandHint: string; mdLabel: string };
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
        "cursor-pointer rounded-lg border p-3 transition-colors md:hidden",
        expanded
          ? "border-brand-accent/30 bg-white/[0.05]"
          : "border-white/[0.06] bg-slate-950/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          className="font-semibold text-white [overflow-wrap:anywhere]"
          style={{ fontSize: "clamp(0.8125rem, 3vw, 0.9375rem)" }}
        >
          {row.name}
        </h3>
        <span className="shrink-0 rounded bg-white/5 px-2 py-0.5 text-xs text-slate-400">
          {labels.group} {row.group_letter}
        </span>
      </div>
      {!expanded ? (
        <p className="mt-2 text-[10px] text-slate-600">{labels.expandHint}</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {matchdays.map((md) => {
            const f = row.fixtures.find((x) => x.matchday === md);
            return f ? (
              <div
                key={md}
                className={cn("rounded-md px-2 py-1.5 text-center text-xs", fdrClass(f.fdr))}
              >
                <div className="text-[9px] uppercase opacity-80">
                  {labels.mdLabel}
                  {md}
                </div>
                <div className="font-semibold">{f.opp_name}</div>
                <div className="text-[10px]">FDR {f.fdr}</div>
              </div>
            ) : (
              <div
                key={md}
                className="rounded border border-white/5 px-2 py-1.5 text-center text-slate-600"
              >
                —
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

export function WcFdrGrid({
  rows,
  matchdays,
  title,
  summary,
  detail,
  moreLabel,
  labels,
}: {
  rows: WcFdrRow[];
  matchdays: number[];
  title: string;
  summary?: string;
  detail?: string;
  moreLabel?: string;
  labels: { team: string; group: string; expandHint: string; mdLabel: string };
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <WcSectionIntro
        title={title}
        summary={summary}
        detail={detail}
        moreLabel={moreLabel}
      />

      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((t) => (
          <TeamRow
            key={t.team_id}
            row={t}
            matchdays={matchdays}
            expanded={expandedId === t.team_id}
            onToggle={() =>
              setExpandedId(expandedId === t.team_id ? null : t.team_id)
            }
            labels={labels}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] md:block">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase text-slate-500">
              <th className="px-3 py-2">{labels.team}</th>
              <th className="px-2 py-2">{labels.group}</th>
              {matchdays.map((md) => (
                <th key={md} className="px-2 py-2 text-center">
                  MD{md}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.team_id} className="border-t border-white/5">
                <td className="px-3 py-2 font-medium text-white">{t.name}</td>
                <td className="px-2 py-2 text-slate-500">{t.group_letter}</td>
                {matchdays.map((md) => {
                  const f = t.fixtures.find((x) => x.matchday === md);
                  return (
                    <td key={md} className="px-1 py-1 align-middle">
                      {f ? (
                        <div
                          className={cn(
                            "rounded px-2 py-1 text-center",
                            fdrClass(f.fdr),
                          )}
                          title={`FDR ${f.fdr} vs ${f.opp_name}${f.home ? " (H)" : " (A)"}`}
                        >
                          <div className="font-semibold">{f.opp_name}</div>
                          <div className="text-[10px] opacity-90">FDR {f.fdr}</div>
                        </div>
                      ) : (
                        <div className="rounded border border-white/5 px-2 py-1 text-center text-slate-600">
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
