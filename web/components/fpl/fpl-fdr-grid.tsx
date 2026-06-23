"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { fdrClass } from "@/lib/fpl/fdr";
import type { FplFdrRow } from "@/lib/fpl/fixtures-grid";

function TeamRow({
  row,
  gwHeaders,
  dgwKeys,
  expanded,
  onToggle,
  labels,
}: {
  row: FplFdrRow;
  gwHeaders: number[];
  dgwKeys: Set<string>;
  expanded: boolean;
  onToggle: () => void;
  labels: { expandHint: string; gwLabel: string };
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
          ? "border-brand-accent/30 bg-card"
          : "border-border bg-card/80",
      )}
    >
      <h3
        className="font-semibold text-foreground [overflow-wrap:anywhere]"
        style={{ fontSize: "clamp(0.8125rem, 3vw, 0.9375rem)" }}
      >
        {row.name}
      </h3>
      {!expanded ? (
        <p className="mt-2 text-[10px] text-muted-foreground/80">
          {labels.expandHint}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {gwHeaders.map((gw) => {
            const fs = row.fixtures.filter((x) => x.gw === gw);
            const isDgw =
              fs.length >= 2 || dgwKeys.has(`${row.team_id}:${gw}`);
            return fs.length > 0 ? (
              <div
                key={gw}
                className={cn(
                  "flex flex-col gap-1 rounded-md border border-border px-1.5 py-1.5 text-center text-xs",
                  isDgw &&
                    "ring-2 ring-yellow-400/80 ring-offset-1 ring-offset-background",
                )}
              >
                <div className="text-[9px] uppercase opacity-80">
                  {labels.gwLabel}
                  {gw}
                </div>
                {fs.map((f) => (
                  <div
                    key={f.fixture_id}
                    className={cn("rounded-md px-1.5 py-1", fdrClass(f.fdr))}
                  >
                    <div className="font-semibold">
                      {f.opp}
                      {!f.home ? " (A)" : ""}
                    </div>
                    <div className="text-[10px]">FDR {f.fdr}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                key={gw}
                className="rounded border border-border/60 px-2 py-1.5 text-center text-muted-foreground/80"
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

export function FplFdrGrid({
  rows,
  gwHeaders,
  dgwKeys,
  title,
  summary,
  detail,
  moreLabel,
  hint,
  labels,
}: {
  rows: FplFdrRow[];
  gwHeaders: number[];
  dgwKeys: string[];
  title: string;
  summary?: string;
  detail?: string;
  moreLabel?: string;
  hint?: string;
  labels: {
    team: string;
    expandHint: string;
    gwLabel: string;
    dgw: string;
  };
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const dgwSet = new Set(dgwKeys);

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {summary}
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {detail ? (
            <details className="mt-2 text-sm text-muted-foreground">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="underline decoration-dotted underline-offset-2">
                  {moreLabel}
                </span>
              </summary>
              <p className="mt-2 leading-relaxed">{detail}</p>
            </details>
          ) : null}
        </div>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((t) => (
          <TeamRow
            key={t.team_id}
            row={t}
            gwHeaders={gwHeaders}
            dgwKeys={dgwSet}
            expanded={expandedId === t.team_id}
            onToggle={() =>
              setExpandedId(expandedId === t.team_id ? null : t.team_id)
            }
            labels={labels}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">{labels.team}</th>
              {gwHeaders.map((gw) => (
                <th key={gw} className="px-2 py-2 text-center">
                  GW{gw}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.team_id} className="border-t border-border/60">
                <td className="px-3 py-2 font-medium">{t.short}</td>
                {gwHeaders.map((gw) => {
                  const fs = t.fixtures.filter((x) => x.gw === gw);
                  const isDgw =
                    fs.length >= 2 || dgwSet.has(`${t.team_id}:${gw}`);
                  return (
                    <td key={gw} className="px-1.5 py-1.5 align-top">
                      {fs.length > 0 ? (
                        <div
                          className={cn(
                            "flex min-h-[2.75rem] flex-col gap-1 rounded-md border border-border px-1.5 py-1 text-center text-xs",
                            isDgw &&
                              "ring-2 ring-yellow-400 ring-offset-2 ring-offset-background shadow-[0_0_0_1px_rgba(250,204,21,0.35)]",
                          )}
                        >
                          {fs.map((f) => (
                            <div
                              key={f.fixture_id}
                              className={cn(
                                "rounded-md border px-1.5 py-0.5",
                                fdrClass(f.fdr),
                              )}
                              title={`FDR ${f.fdr} vs ${f.opp_name}${f.home ? " (H)" : " (A)"}`}
                            >
                              <div className="font-semibold">
                                {f.opp}
                                {!f.home ? " (A)" : ""}
                              </div>
                              <div className="text-[10px] text-foreground/90">
                                FDR {f.fdr}
                              </div>
                            </div>
                          ))}
                          {isDgw && fs.length >= 2 ? (
                            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-yellow-200/95">
                              {labels.dgw}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-md border border-border/60 bg-muted px-2 py-1 text-center text-xs text-muted-foreground">
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
