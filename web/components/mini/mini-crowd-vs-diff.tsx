"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type MiniHotPickRow = {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  position: string | null;
  selected_count: number;
  selected_pct: number;
  captain_count: number;
  fpl_owned_pct?: number | null;
  form?: number | null;
};

function PickList({
  picks,
  emptyLabel,
  showFplOwn,
}: {
  picks: MiniHotPickRow[];
  emptyLabel: string;
  showFplOwn?: boolean;
}) {
  const t = useTranslations("mini");
  if (picks.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ol className="divide-y divide-border rounded-lg border border-border">
      {picks.map((p, i) => (
        <li
          key={p.fpl_id}
          className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <span className="mr-2 text-muted-foreground">{i + 1}.</span>
            <span className="font-medium text-foreground">
              {p.web_name ?? p.fpl_id}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              {p.team} · {p.position}
            </span>
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            {showFplOwn && p.fpl_owned_pct != null ? (
              <div>{t("diffFplOwn", { pct: p.fpl_owned_pct })}</div>
            ) : (
              <div>{t("hotPicksOwn", { pct: p.selected_pct })}</div>
            )}
            {p.form != null ? (
              <div>{t("diffForm", { form: p.form.toFixed(1) })}</div>
            ) : p.captain_count > 0 ? (
              <div>{t("hotPicksCap", { n: p.captain_count })}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function MiniCrowdVsDiff({
  gw,
  entries,
  crowd,
  differentials,
}: {
  gw: number | null;
  entries: number;
  crowd: MiniHotPickRow[];
  differentials: MiniHotPickRow[];
}) {
  const t = useTranslations("mini");
  const early = entries < 5;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {t("crowdDiffTitle", { gw: gw ?? "—" })}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("crowdDiffHint")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("crowdTitle")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("hotPicksHint", { n: entries })}
          </p>
          <PickList picks={crowd} emptyLabel={t("hotPicksEmpty")} />
        </div>
        <div className="space-y-2">
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              "text-brand-accent",
            )}
          >
            {t("diffTitle")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {early ? t("diffHintEarly") : t("diffHint")}
          </p>
          <PickList
            picks={differentials}
            emptyLabel={t("diffEmpty")}
            showFplOwn={early}
          />
        </div>
      </div>
    </section>
  );
}
