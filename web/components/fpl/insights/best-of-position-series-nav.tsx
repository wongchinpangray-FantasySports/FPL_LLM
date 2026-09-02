"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  BEST_OF_POSITION_HUB_HREF,
  VALUE_BAND_POSITION_ORDER,
  formatValueBandRange,
  groupValueBandsByPosition,
  type ValueBandPosition,
  type ValueBandPreset,
} from "@/lib/fpl/insights/value-bands";

const POS_LABEL_KEY: Record<ValueBandPosition, string> = {
  GKP: "posGKP",
  DEF: "posDEF",
  MID: "posMID",
  FWD: "posFWD",
};

export function BestOfPositionSeriesNav({
  currentId,
  activePosition,
}: {
  currentId?: string | null;
  /** When on hub, optionally highlight a position section (unused); band pages pass preset.position. */
  activePosition?: ValueBandPosition | null;
}) {
  const t = useTranslations("fplInsights.bestOfPosition");
  const grouped = groupValueBandsByPosition();
  const focusPos = activePosition ?? null;

  return (
    <nav
      aria-label={t("seriesNavAria")}
      className="rounded-xl border border-border bg-card/50 p-3"
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={BEST_OF_POSITION_HUB_HREF}
          className={cn(
            "text-sm font-semibold no-underline",
            !currentId
              ? "text-brand-accent"
              : "text-foreground hover:text-brand-accent",
          )}
        >
          {t("seriesTitle")}
        </Link>
        <span className="text-[11px] text-muted-foreground">{t("seriesHint")}</span>
      </div>
      <div className="flex flex-col gap-3">
        {VALUE_BAND_POSITION_ORDER.map((pos) => {
          const bands = grouped.get(pos) ?? [];
          const posActive =
            focusPos === pos ||
            bands.some((b: ValueBandPreset) => b.id === currentId);
          return (
            <div key={pos}>
              <div
                className={cn(
                  "mb-1.5 text-[11px] font-semibold uppercase tracking-wide",
                  posActive ? "text-brand-accent" : "text-muted-foreground",
                )}
              >
                {t(POS_LABEL_KEY[pos] as "posMID")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bands.map((band) => {
                  const active = band.id === currentId;
                  return (
                    <Link
                      key={band.id}
                      href={band.href}
                      className={cn(
                        "rounded-lg border px-2 py-1 text-xs font-medium tabular-nums no-underline transition-colors",
                        active
                          ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                          : "border-border bg-background/60 text-muted-foreground hover:border-brand-accent/25 hover:text-foreground",
                      )}
                    >
                      £{formatValueBandRange(band.minPrice, band.maxPrice)}m
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
