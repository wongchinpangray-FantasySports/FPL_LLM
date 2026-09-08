"use client";

import { cn } from "@/lib/utils";
import type {
  TransferStance,
  TransferStanceReason,
  TransferStanceResult,
} from "@/lib/transfers/stance";

const STANCE_TONE: Record<TransferStance, string> = {
  buy: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  hold: "border-border bg-muted/40 text-foreground/85",
  sell: "border-rose-500/40 bg-rose-500/15 text-rose-300",
};

export function TransferStanceBadge({
  result,
  labels,
}: {
  result: TransferStanceResult;
  labels: {
    title: string;
    buy: string;
    hold: string;
    sell: string;
    caption: string;
    reasons: Record<TransferStanceReason, string>;
  };
}) {
  const word =
    result.stance === "buy"
      ? labels.buy
      : result.stance === "sell"
        ? labels.sell
        : labels.hold;

  return (
    <section className="rounded-xl border border-border bg-card/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{labels.caption}</p>
        </div>
        <span
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-semibold",
            STANCE_TONE[result.stance],
          )}
        >
          {word}
        </span>
      </div>
      {result.reasons.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {result.reasons.map((r) => (
            <li
              key={r}
              className="rounded-md border border-border/70 bg-black/20 px-2 py-1 text-[11px] text-muted-foreground"
            >
              {labels.reasons[r]}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
