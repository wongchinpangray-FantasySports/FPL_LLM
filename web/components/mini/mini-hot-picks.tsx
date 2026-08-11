"use client";

import { useTranslations } from "next-intl";

export type MiniHotPickRow = {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  position: string | null;
  selected_count: number;
  selected_pct: number;
  captain_count: number;
};

export function MiniHotPicks({
  gw,
  entries,
  picks,
}: {
  gw: number | null;
  entries: number;
  picks: MiniHotPickRow[];
}) {
  const t = useTranslations("mini");

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">
        {t("hotPicksTitle", { gw: gw ?? "—" })}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t("hotPicksHint", { n: entries })}
      </p>
      {picks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("hotPicksEmpty")}</p>
      ) : (
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
                <div>{t("hotPicksOwn", { pct: p.selected_pct })}</div>
                {p.captain_count > 0 ? (
                  <div>{t("hotPicksCap", { n: p.captain_count })}</div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
