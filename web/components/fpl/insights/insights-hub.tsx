"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  INSIGHT_GROUP_ORDER,
  insightsByGroup,
} from "@/lib/fpl/insights/catalog";
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

function InsightTile({
  entry,
  featured,
  locked,
  t,
}: {
  entry: InsightDefinition;
  featured: boolean;
  locked: boolean;
  t: ReturnType<typeof useTranslations<"fplInsights">>;
}) {
  const title = t(entry.titleKey as Parameters<typeof t>[0]);
  const description = t(entry.descriptionKey as Parameters<typeof t>[0]);
  const badge = entry.badgeKey ? t(entry.badgeKey) : null;

  return (
    <Link
      href={entry.href}
      className={cn(
        "flex h-full flex-col rounded-xl border p-4 no-underline transition-colors",
        featured
          ? "border-brand-accent/35 bg-brand-accent/5 hover:bg-brand-accent/10"
          : "border-border bg-card hover:border-brand-accent/25 hover:bg-muted/50",
        locked && "opacity-90",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
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
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-snug text-muted-foreground">
        {description}
      </p>
    </Link>
  );
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
  const grouped = insightsByGroup(entries);

  return (
    <div className="flex flex-col gap-8">
      {INSIGHT_GROUP_ORDER.map((section) => {
        const items = grouped.get(section.id) ?? [];
        if (items.length === 0) return null;

        return (
          <section key={section.id} className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(section.labelKey as Parameters<typeof t>[0])}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((entry) => (
                <InsightTile
                  key={entry.id}
                  entry={entry}
                  featured={entry.id === featuredId}
                  locked={enforcePremium && lockedIds.includes(entry.id)}
                  t={t}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
