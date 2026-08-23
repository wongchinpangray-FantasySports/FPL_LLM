"use client";

import { useTranslations } from "next-intl";
import { MINI_BADGES, type MiniBadgeId } from "@/lib/mini/badges";
import type { MiniBadgeEventRow } from "@/lib/mini/badge-events";
import { cn } from "@/lib/utils";

function countByBadge(events: MiniBadgeEventRow[]): Map<MiniBadgeId, number> {
  const m = new Map<MiniBadgeId, number>();
  for (const e of events) {
    m.set(e.badge_id, (m.get(e.badge_id) ?? 0) + 1);
  }
  return m;
}

export function MiniBadges({
  unlocked,
  highlight,
  events,
  compact,
  showHistory,
}: {
  unlocked: MiniBadgeId[];
  highlight?: MiniBadgeId[];
  events?: MiniBadgeEventRow[];
  compact?: boolean;
  showHistory?: boolean;
}) {
  const t = useTranslations("mini");
  const set = new Set(unlocked);
  const flash = new Set(highlight ?? []);
  const counts = events ? countByBadge(events) : null;
  const totalEarned = events?.length ?? unlocked.length;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("badgesTitle")}</h3>
        {totalEarned > 0 ? (
          <span className="text-xs font-medium tabular-nums text-brand-accent">
            {t("badgesTotalEarned", { n: totalEarned })}
          </span>
        ) : null}
      </div>
      {!compact ? (
        <p className="text-xs text-muted-foreground">{t("badgesHint")}</p>
      ) : null}
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        {MINI_BADGES.map((b) => {
          const on = set.has(b.id);
          const earned = counts?.get(b.id) ?? (on ? 1 : 0);
          return (
            <div
              key={b.id}
              className={cn(
                "rounded-lg border px-3 py-2",
                on
                  ? "border-brand-accent/40 bg-brand-accent/5"
                  : "border-border bg-muted/30 opacity-60",
                flash.has(b.id) && "ring-2 ring-brand-accent",
              )}
            >
              <p className="text-sm font-medium text-foreground">
                {on ? "★ " : "☆ "}
                {t(b.titleKey as "badgeFirstSquadTitle")}
                {earned > 1 ? (
                  <span className="ml-1.5 text-xs font-bold tabular-nums text-brand-accent">
                    ×{earned}
                  </span>
                ) : null}
              </p>
              {!compact ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(b.descKey as "badgeFirstSquadDesc")}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {showHistory && events && events.length > 0 ? (
        <div className="mt-3">
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("badgesHistory")}
          </h4>
          <ol className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-card/40 px-3 py-2 text-xs">
            {events.slice(0, 30).map((ev) => {
              const def = MINI_BADGES.find((b) => b.id === ev.badge_id);
              return (
                <li
                  key={ev.id}
                  className="flex items-center justify-between gap-2 border-b border-border/50 py-1 last:border-b-0"
                >
                  <span className="text-foreground">
                    {def ? t(def.titleKey as "badgeFirstSquadTitle") : ev.badge_id}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {ev.gw != null ? t("badgeEventGw", { gw: ev.gw }) : t("badgeEventOnce")}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
