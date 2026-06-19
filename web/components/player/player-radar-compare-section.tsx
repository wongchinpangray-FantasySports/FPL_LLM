"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PlayerRadarChart } from "@/components/player/player-radar-chart";
import type { PlayerRadarAxes } from "@/lib/player-hub";

type SearchHit = {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  position: string | null;
};

type Six = [number, number, number, number, number, number];

function axesToTuple(r: PlayerRadarAxes): Six {
  return [
    r.form,
    r.goals_per_90,
    r.assists_per_90,
    r.defcon_per_90,
    r.xg_per_90,
    r.xa_per_90,
  ];
}

export function PlayerRadarCompareSection({
  baseFplId,
  basePosition,
  baseRadar,
}: {
  baseFplId: number;
  basePosition: string | null;
  baseRadar: PlayerRadarAxes;
}) {
  const t = useTranslations("playerPage");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [compare, setCompare] = useState<{
    fpl_id: number;
    label: string;
    position: string | null;
    values: Six;
  } | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  const baseValues = axesToTuple(baseRadar);

  const runSearch = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length < 2) {
      setHits([]);
      return;
    }
    setLoadingSearch(true);
    try {
      const res = await fetch(
        `/api/planner/players?q=${encodeURIComponent(trimmed)}`,
      );
      const data = (await res.json()) as { players?: SearchHit[] };
      const list = (data.players ?? []).filter((p) => p.fpl_id !== baseFplId);
      setHits(list);
    } catch {
      setHits([]);
    } finally {
      setLoadingSearch(false);
    }
  }, [baseFplId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void runSearch(q);
    }, 220);
    return () => window.clearTimeout(id);
  }, [q, runSearch]);

  async function pickPlayer(hit: SearchHit) {
    setQ("");
    setHits([]);
    setLoadingCompare(true);
    try {
      const res = await fetch(`/api/player/${hit.fpl_id}/radar`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        radar: PlayerRadarAxes;
        label: string;
        position: string | null;
        fpl_id: number;
      };
      setCompare({
        fpl_id: data.fpl_id,
        label: data.label,
        position: data.position,
        values: axesToTuple(data.radar),
      });
    } catch {
      /* ignore */
    } finally {
      setLoadingCompare(false);
    }
  }

  const posMismatch =
    compare &&
    basePosition &&
    compare.position &&
    basePosition !== compare.position;

  const labels: [string, string, string, string, string, string] = [
    t("radarForm"),
    t("radarGoalsP90"),
    t("radarAssistsP90"),
    t("radarDefconP90"),
    t("radarXgP90"),
    t("radarXaP90"),
  ];

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">{t("radarTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("radarSubtitle")}</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3 lg:max-w-md">
          <div>
            <label
              htmlFor="radar-compare-search"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              {t("radarCompareLabel")}
            </label>
            <input
              id="radar-compare-search"
              type="search"
              autoComplete="off"
              placeholder={t("radarComparePlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">{t("radarCompareHint")}</p>
          </div>

          {loadingSearch ? (
            <p className="text-xs text-muted-foreground">{t("radarCompareSearching")}</p>
          ) : q.trim().length >= 2 && hits.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("radarCompareNoHits")}</p>
          ) : hits.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-border bg-black/25 text-sm">
              {hits.map((h) => {
                const name = h.web_name ?? h.name ?? `#${h.fpl_id}`;
                return (
                  <li key={h.fpl_id} className="border-b border-border/60 last:border-0">
                    <button
                      type="button"
                      disabled={loadingCompare}
                      onClick={() => void pickPlayer(h)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-foreground/90 transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <span className="font-medium text-foreground">{name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {h.team ?? "—"} · {h.position ?? "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {compare ? (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-foreground/90">
                  <span className="text-muted-foreground">{t("radarCompareVs")} </span>
                  <span className="font-medium text-foreground">{compare.label}</span>
                  {compare.position ? (
                    <span className="text-muted-foreground"> · {compare.position}</span>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => setCompare(null)}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-foreground/70 transition-colors hover:border-border hover:text-foreground"
                >
                  {t("radarCompareClear")}
                </button>
              </div>
              {posMismatch ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {t("radarComparePosNote")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-accent" aria-hidden />
              {t("radarLegendYou")}
            </span>
            {compare ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full bg-amber-400"
                  aria-hidden
                />
                {compare.label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 opacity-50">
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                {t("radarLegendCompare")}
              </span>
            )}
          </div>
        </div>

        <PlayerRadarChart
          values={baseValues}
          labels={labels}
          caption={t("radarCaption")}
          compare={
            compare
              ? { values: compare.values, name: compare.label }
              : undefined
          }
        />
      </div>
    </section>
  );
}
