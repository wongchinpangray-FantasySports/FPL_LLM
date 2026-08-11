"use client";

import { useTranslations } from "next-intl";
import { MINI_BADGES, type MiniBadgeId } from "@/lib/mini/badges";
import { cn } from "@/lib/utils";

export function MiniBadges({
  unlocked,
  highlight,
}: {
  unlocked: MiniBadgeId[];
  highlight?: MiniBadgeId[];
}) {
  const t = useTranslations("mini");
  const set = new Set(unlocked);
  const flash = new Set(highlight ?? []);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{t("badgesTitle")}</h3>
      <p className="text-xs text-muted-foreground">{t("badgesHint")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {MINI_BADGES.map((b) => {
          const on = set.has(b.id);
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
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(b.descKey as "badgeFirstSquadDesc")}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
