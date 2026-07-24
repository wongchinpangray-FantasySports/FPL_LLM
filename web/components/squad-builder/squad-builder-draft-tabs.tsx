"use client";

import { cn } from "@/lib/utils";

export function SquadBuilderDraftTabs({
  drafts,
  activeDraft,
  xptByDraft,
  onSelect,
  label,
  draftLabel,
}: {
  drafts: number[];
  activeDraft: number;
  xptByDraft: Record<number, number | null>;
  onSelect: (draftIndex: number) => void;
  label: string;
  draftLabel: (draftIndex: number) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {drafts.map((draftIndex) => {
          const xpt = xptByDraft[draftIndex];
          const active = draftIndex === activeDraft;
          return (
            <button
              key={draftIndex}
              type="button"
              onClick={() => onSelect(draftIndex)}
              className={cn(
                "flex min-w-[4.25rem] flex-col items-center rounded-lg border px-2.5 py-1.5 text-center transition-colors",
                active
                  ? "border-brand-accent/50 bg-brand-accent/15 text-foreground"
                  : "border-border bg-card/40 text-muted-foreground hover:border-border/80 hover:text-foreground",
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {draftLabel(draftIndex)}
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
