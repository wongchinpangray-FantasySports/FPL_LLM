"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { InsightDefinition } from "@/lib/fpl/insights/types";

function badgeClass(badgeKey?: InsightDefinition["badgeKey"]): string {
  switch (badgeKey) {
    case "badgeLive":
      return "border-brand-accent/40 bg-brand-accent/10 text-brand-accent";
    case "badgePremium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    case "badgeFree":
      return "border-border bg-muted text-muted-foreground";
    case "badgeSoon":
    default:
      return "border-border bg-card text-muted-foreground";
  }
}

export function InsightsHub({
  entries,
  featuredId,
  lockedIds,
  enforcePremium,
}: {
  entries: InsightDefinition[];
  featuredId?: string;
  lockedIds: string[];
  enforcePremium: boolean;
}) {
  const t = useTranslations("fplInsights");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map((entry) => {
        const locked = enforcePremium && lockedIds.includes(entry.id);
        const featured = entry.id === featuredId;
        const title = t(entry.titleKey as Parameters<typeof t>[0]);
        const description = t(entry.descriptionKey as Parameters<typeof t>[0]);
        const badge = entry.badgeKey ? t(entry.badgeKey) : null;

        return (
          <Link
            key={entry.id}
            href={entry.href}
            className={cn(
              "block rounded-xl border p-4 no-underline transition-colors",
              featured
                ? "border-brand-accent/35 bg-brand-accent/5 hover:bg-brand-accent/10"
                : "border-border bg-card hover:border-brand-accent/25 hover:bg-muted/50",
              locked && "opacity-90",
            )}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {badge ? (
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    badgeClass(entry.badgeKey),
                  )}
                >
                  {badge}
                </span>
              ) : null}
              {locked ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                  {t("badgeLocked")}
                </span>
              ) : null}
            </div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </Link>
        );
      })}
    </div>
  );
}
