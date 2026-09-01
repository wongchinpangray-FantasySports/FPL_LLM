"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SquadChangeEntry =
  | {
      kind: "transfer";
      slot: number;
      outName: string;
      inName: string;
    }
  | {
      kind: "lineup";
      slot: number;
      name: string;
      toStarter: boolean;
    };

export function PlannerChangesStrip({
  changes,
  bank,
  xiDelta,
  showXiDelta,
  onUndo,
}: {
  changes: SquadChangeEntry[];
  bank: number;
  xiDelta: number;
  showXiDelta: boolean;
  onUndo: (slot: number) => void;
}) {
  const t = useTranslations("plannerApp");

  if (changes.length === 0) return null;

  return (
    <div className="rounded-xl border border-brand-accent/20 bg-brand-accent/5 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold text-foreground">
          {t("changesSummary", { n: changes.length })}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {t("changesBank", { bank: bank.toFixed(1) })}
        </span>
        {showXiDelta ? (
          <span
            className={cn(
              "tabular-nums font-medium",
              xiDelta >= 0 ? "text-emerald-400" : "text-rose-300",
            )}
          >
            {t("changesXiDelta", {
              delta: `${xiDelta >= 0 ? "+" : ""}${xiDelta.toFixed(1)}`,
            })}
          </span>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1.5">
        {changes.map((c) => (
          <li
            key={`${c.kind}-${c.slot}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5 text-xs sm:text-sm"
          >
            <span className="min-w-0 text-foreground/90">
              {c.kind === "transfer" ? (
                <>
                  <span className="text-rose-300/90">{c.outName}</span>
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  <span className="text-emerald-300/90">{c.inName}</span>
                </>
              ) : (
                <>
                  {c.name}{" "}
                  <span className="text-muted-foreground">
                    {c.toStarter ? t("changeToXi") : t("changeToBench")}
                  </span>
                </>
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => onUndo(c.slot)}
            >
              {t("changeUndo")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
