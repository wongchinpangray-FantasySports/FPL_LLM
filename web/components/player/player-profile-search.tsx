"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Hit = {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
  status: string | null;
  form: number | null;
  total_points: number | null;
  minutes: number | null;
  selected_by_percent: number | null;
  points_per_game: number | null;
  ict_index: number | null;
  goals_scored: number | null;
  assists: number | null;
  expected_goals: number | null;
  expected_assists: number | null;
};

export function PlayerProfileSearch() {
  const t = useTranslations("playersIndex");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/planner/players?q=${encodeURIComponent(trimmed)}`,
      );
      const data = (await res.json()) as { players?: Hit[] };
      setHits(data.players ?? []);
    } catch {
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void runSearch(q);
    }, 220);
    return () => window.clearTimeout(id);
  }, [q, runSearch]);

  function goToProfile(fplId: number) {
    router.push(`/player/${fplId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="player-search" className="mb-2 block text-sm text-slate-400">
          {t("searchLabel")}
        </label>
        <input
          id="player-search"
          type="search"
          autoComplete="off"
          placeholder={t("searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-xl rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
        />
        <p className="mt-2 text-xs text-slate-500">{t("searchHint")}</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{t("searching")}</p>
      ) : q.trim().length >= 2 && hits.length === 0 ? (
        <p className="text-sm text-slate-500">{t("noResults")}</p>
      ) : hits.length > 0 ? (
        <ul className="max-w-xl divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03]">
          {hits.map((p) => {
            const label = p.web_name ?? p.name ?? `#${p.fpl_id}`;
            return (
              <li key={p.fpl_id}>
                <button
                  type="button"
                  onClick={() => goToProfile(p.fpl_id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-white/5"
                >
                  <span>
                    <span className="font-medium text-white">{label}</span>
                    <span className="ml-2 text-slate-500">
                      {p.team ?? "—"} · {p.position ?? "—"} · £
                      {p.base_price != null ? p.base_price.toFixed(1) : "?"}m
                      {p.total_points != null && <> · {p.total_points} pts</>}
                      {p.form != null && (
                        <> · form {Number(p.form).toFixed(1)}</>
                      )}
                      {p.selected_by_percent != null && (
                        <>
                          {" "}
                          · {Number(p.selected_by_percent).toFixed(0)}% own
                        </>
                      )}
                      {p.ict_index != null && (
                        <> · ICT {Number(p.ict_index).toFixed(1)}</>
                      )}
                      {p.status && p.status !== "a" && (
                        <span className="text-amber-400/90"> · {p.status}</span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-brand-accent">{t("openProfile")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
