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
  return [r.form, r.influence, r.creativity, r.threat, r.xg, r.xa];
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
    t("radarInf"),
    t("radarCre"),
    t("radarThr"),
    t("radarXg"),
    t("radarXa"),
  ];

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-white">{t("radarTitle")}</h2>
        <p className="text-xs text-slate-500">{t("radarSubtitle")}</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3 lg:max-w-md">
          <div>
            <label
              htmlFor="radar-compare-search"
              className="mb-1.5 block text-xs font-medium text-slate-400"
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
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">{t("radarCompareHint")}</p>
          </div>

          {loadingSearch ? (
            <p className="text-xs text-slate-500">{t("radarCompareSearching")}</p>
          ) : q.trim().length >= 2 && hits.length === 0 ? (
            <p className="text-xs text-slate-500">{t("radarCompareNoHits")}</p>
          ) : hits.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/25 text-sm">
              {hits.map((h) => {
                const name = h.web_name ?? h.name ?? `#${h.fpl_id}`;
                return (
                  <li key={h.fpl_id} className="border-b border-white/5 last:border-0">
                    <button
                      type="button"
                      disabled={loadingCompare}
                      onClick={() => void pickPlayer(h)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-slate-200 transition-colors hover:bg-white/5 disabled:opacity-50"
                    >
                      <span className="font-medium text-white">{name}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {h.team ?? "—"} · {h.position ?? "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {compare ? (
            <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-slate-200">
                  <span className="text-slate-500">{t("radarCompareVs")} </span>
                  <span className="font-medium text-white">{compare.label}</span>
                  {compare.position ? (
                    <span className="text-slate-500"> · {compare.position}</span>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => setCompare(null)}
                  className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-white/25 hover:text-white"
                >
                  {t("radarCompareClear")}
                </button>
              </div>
              {posMismatch ? (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  {t("radarComparePosNote")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-accent" aria-hidden />
              {t("radarLegendYou")}
            </span>
            {compare ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full bg-sky-400"
                  aria-hidden
                />
                {compare.label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 opacity-50">
                <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
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
