"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function MiniMissionPanel({
  gw,
  titleKey,
  bodyKey,
  completed,
}: {
  gw: number | null;
  titleKey: string;
  bodyKey: string;
  completed?: boolean;
}) {
  const t = useTranslations("mini");

  return (
    <section className="space-y-2 rounded-xl border border-brand-accent/25 bg-brand-accent/5 p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-accent">
          {t("missionEyebrow", { gw: gw ?? "—" })}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-foreground">
          {t(titleKey as "missionIncludeDiffTitle")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(bodyKey as "missionIncludeDiffBody")}
        </p>
      </div>
      <p
        className={cn(
          "text-xs font-medium",
          completed ? "text-brand-accent" : "text-muted-foreground",
        )}
      >
        {completed ? t("missionDone") : t("missionTodo")}
      </p>
    </section>
  );
}
