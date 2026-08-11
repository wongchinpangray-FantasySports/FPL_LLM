"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { MiniPlayerDisplay } from "@/lib/mini/player-stats";

export type MiniTemplatePayload = {
  id: string;
  titleKey: string;
  bodyKey: string;
  pick_ids: number[];
  captain_fpl_id: number;
  vice_fpl_id: number;
  players: MiniPlayerDisplay[];
};

export function MiniTemplates({
  templates,
  disabled,
  onApply,
}: {
  templates: MiniTemplatePayload[];
  disabled?: boolean;
  onApply: (template: MiniTemplatePayload) => void;
}) {
  const t = useTranslations("mini");
  if (templates.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{t("templatesTitle")}</h3>
      <p className="text-xs text-muted-foreground">{t("templatesHint")}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-lg border border-border bg-card p-3"
          >
            <p className="text-sm font-medium text-foreground">
              {t(tpl.titleKey as "templateSafeTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(tpl.bodyKey as "templateSafeBody")}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {tpl.players.map((p) => p.web_name).join(" · ")}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3 w-full"
              disabled={disabled}
              onClick={() => onApply(tpl)}
            >
              {t("templateApply")}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
