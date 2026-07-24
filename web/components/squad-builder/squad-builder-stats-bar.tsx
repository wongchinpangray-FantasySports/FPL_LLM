"use client";

import { cn } from "@/lib/utils";

export function SquadBuilderStatsBar({
  bank,
  spend,
  budget,
  xptsNextGw,
  xptsHorizon,
  nextGwLabel,
  labels,
}: {
  bank: number;
  spend: number;
  budget: number;
  xptsNextGw: number | null;
  xptsHorizon: number | null;
  nextGwLabel: string;
  labels: {
    bank: string;
    cost: string;
    xpts: string;
    xptsHorizon: string;
  };
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCell label={labels.bank} value={`£${bank.toFixed(1)}m`} accent />
      <StatCell
        label={labels.cost}
        value={`£${spend.toFixed(1)}m`}
        sub={`/ £${budget.toFixed(1)}m`}
      />
      <StatCell
        label={labels.xpts}
        value={xptsNextGw != null ? xptsNextGw.toFixed(1) : "–"}
        sub={nextGwLabel}
        accent={xptsNextGw != null}
      />
      <StatCell
        label={labels.xptsHorizon}
        value={xptsHorizon != null ? xptsHorizon.toFixed(1) : "–"}
      />
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-xl font-semibold tabular-nums tracking-tight",
          accent ? "text-brand-accent" : "text-foreground",
        )}
      >
        {value}
      </div>
      {sub ? (
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  );
}
