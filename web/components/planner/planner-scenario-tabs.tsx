"use client";

import { cn } from "@/lib/utils";
import {
  scenarioIndexRange,
  scenarioLetter,
  type ScenarioIndex,
} from "@/lib/planner/scenario-draft";

export type PlannerViewTab = "fpl" | ScenarioIndex;

export function PlannerScenarioTabs({
  viewTab,
  xptByScenario,
  onSelect,
  fplLabel,
  planLabel,
  scenariosLabel,
}: {
  viewTab: PlannerViewTab;
  xptByScenario: Record<ScenarioIndex, number | null>;
  onSelect: (tab: PlannerViewTab) => void;
  fplLabel: string;
  planLabel: (index: ScenarioIndex) => string;
  scenariosLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-muted-foreground">
        {scenariosLabel}
      </div>
      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label={scenariosLabel}
      >
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === "fpl"}
          onClick={() => onSelect("fpl")}
          className={cn(
            "flex min-w-[4.25rem] flex-col items-center rounded-lg border px-2.5 py-1.5 text-center transition-colors",
            viewTab === "fpl"
              ? "border-brand-accent/50 bg-brand-accent/15 text-foreground"
              : "border-border bg-card/40 text-muted-foreground hover:border-border/80 hover:text-foreground",
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            {fplLabel}
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground/80">
            –
          </span>
        </button>
        {scenarioIndexRange().map((index) => {
          const active = viewTab === index;
          const xpt = xptByScenario[index];
          return (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(index)}
              className={cn(
                "flex min-w-[4.25rem] flex-col items-center rounded-lg border px-2.5 py-1.5 text-center transition-colors",
                active
                  ? "border-brand-accent/50 bg-brand-accent/15 text-foreground"
                  : "border-border bg-card/40 text-muted-foreground hover:border-border/80 hover:text-foreground",
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {planLabel(index)}
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

export { scenarioLetter };
