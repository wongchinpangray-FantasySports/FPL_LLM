import { cn } from "@/lib/utils";
import {
  FPL_FDR_LEVELS,
  fdrClass,
  type FplFdrLevel,
} from "@/lib/fpl/fdr";

export function FplFdrLegend({
  labels,
  className,
}: {
  labels: Record<FplFdrLevel, string>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground",
        className,
      )}
      aria-label="Fixture difficulty key"
    >
      {FPL_FDR_LEVELS.map((level) => (
        <span
          key={level}
          className={cn(
            "inline-flex min-w-[4.5rem] items-center justify-center rounded-md border px-2 py-1 font-semibold tabular-nums",
            fdrClass(level),
          )}
        >
          {labels[level]}
        </span>
      ))}
    </div>
  );
}
