"use client";

import { cn } from "@/lib/utils";

export function SquadBuilderGwTabs({
  gws,
  activeGw,
  xptByGw,
  onSelect,
  label,
}: {
  gws: number[];
  activeGw: number;
  xptByGw: Record<number, number | null>;
  onSelect: (gw: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {gws.map((gw) => {
          const xpt = xptByGw[gw];
          const active = gw === activeGw;
          return (
            <button
              key={gw}
              type="button"
              onClick={() => onSelect(gw)}
              className={cn(
                "flex min-w-[4.25rem] flex-col items-center rounded-lg border px-2.5 py-1.5 text-center transition-colors",
                active
                  ? "border-brand-accent/50 bg-brand-accent/15 text-foreground"
                  : "border-border bg-card/40 text-muted-foreground hover:border-border/80 hover:text-foreground",
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                GW{gw}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  active ? "text-brand-accent" : "text-foreground/80",
                )}
              >
                {xpt != null ? xpt.toFixed(1) : "–"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
