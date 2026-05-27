"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { WcFdrRow, WcPlayerListItem, WcXpRow } from "@/lib/wc/data";
import { WcFdrGrid } from "@/components/worldcup/wc-fdr-grid";
import { WcXpHeatmap } from "@/components/worldcup/wc-xp-heatmap";
import { WcRadarChart } from "@/components/worldcup/wc-radar-chart";

type Tab = "fdr" | "xp" | "compare";

type ContextPayload = {
  fdrGrid: WcFdrRow[];
  xp: { matchdays: number[]; rows: WcXpRow[] };
  players: WcPlayerListItem[];
  disclaimer: string;
};

type ComparePayload = {
  a: {
    id: number;
    name: string;
    team_code: string;
    position: string;
    raw: { xg: number; xa: number; form: number; goals: number; assists: number };
    values: number[];
  };
  b: {
    id: number;
    name: string;
    team_code: string;
    position: string;
    raw: { xg: number; xa: number; form: number; goals: number; assists: number };
    values: number[];
  };
  labels: string[];
};

function PlayerPicker({
  label,
  players,
  value,
  onChange,
  excludeId,
}: {
  label: string;
  players: WcPlayerListItem[];
  value: number | null;
  onChange: (id: number | null) => void;
  excludeId?: number | null;
}) {
  const filtered = useMemo(
    () => players.filter((p) => p.id !== excludeId),
    [players, excludeId],
  );

  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      <span>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v ? Number(v) : null);
        }}
        className="rounded-md border border-white/10 bg-slate-900/80 px-2 py-2 text-sm text-white"
      >
        <option value="">—</option>
        {filtered.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.team_code} · {p.position})
          </option>
        ))}
      </select>
    </label>
  );
}

function StatRow({
  label,
  a,
  b,
}: {
  label: string;
  a: number;
  b: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 border-t border-white/5 py-1.5 text-xs">
      <span className="text-right font-medium text-brand-accent">{a.toFixed(2)}</span>
      <span className="text-center text-slate-500">{label}</span>
      <span className="font-medium text-amber-300">{b.toFixed(2)}</span>
    </div>
  );
}

export function WcFantasyApp() {
  const t = useTranslations("worldcup");
  const [tab, setTab] = useState<Tab>("fdr");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ContextPayload | null>(null);
  const [position, setPosition] = useState("ALL");
  const [playerA, setPlayerA] = useState<number | null>(null);
  const [playerB, setPlayerB] = useState<number | null>(null);
  const [compare, setCompare] = useState<ComparePayload | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const loadContext = useCallback(async (pos: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/worldcup/context?position=${encodeURIComponent(pos)}`);
      const data = (await res.json()) as ContextPayload & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setCtx(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext(position);
  }, [loadContext, position]);

  useEffect(() => {
    if (playerA == null) {
      setCompare(null);
      return;
    }
    let cancelled = false;
    setCompareLoading(true);
    const q = playerB != null ? `?a=${playerA}&b=${playerB}` : `?a=${playerA}`;
    fetch(`/api/worldcup/compare${q}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Compare failed");
        if (cancelled) return;
        if (playerB != null) {
          setCompare(data as ComparePayload);
        } else {
          const single = data as {
            player: ComparePayload["a"];
            labels: string[];
          };
          setCompare({
            a: single.player,
            b: single.player,
            labels: single.labels,
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Compare failed");
      })
      .finally(() => {
        if (!cancelled) setCompareLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerA, playerB]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "fdr", label: t("tabFdr") },
    { id: "xp", label: t("tabXp") },
    { id: "compare", label: t("tabCompare") },
  ];

  const positionOptions = [
    { value: "ALL", label: t("posAll") },
    { value: "GKP", label: t("posGkp") },
    { value: "DEF", label: t("posDef") },
    { value: "MID", label: t("posMid") },
    { value: "FWD", label: t("posFwd") },
  ];

  const matchdays = ctx?.xp.matchdays ?? [1, 2, 3];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              tab === item.id
                ? "bg-brand-accent/15 text-brand-accent"
                : "text-slate-400 hover:text-white",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {ctx?.disclaimer ? (
        <p className="text-xs leading-relaxed text-slate-500">{ctx.disclaimer}</p>
      ) : null}

      {loading && !ctx ? (
        <p className="text-sm text-slate-400">{t("loading")}</p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {ctx && tab === "fdr" ? (
        <WcFdrGrid
          rows={ctx.fdrGrid}
          matchdays={matchdays}
          title={t("fdrTitle")}
          hint={t("fdrHint")}
          labels={{ team: t("colTeam"), group: t("colGroup") }}
        />
      ) : null}

      {ctx && tab === "xp" ? (
        <WcXpHeatmap
          rows={ctx.xp.rows}
          matchdays={matchdays}
          title={t("xpTitle")}
          hint={t("xpHint")}
          labels={{
            player: t("colPlayer"),
            team: t("colTeam"),
            pos: t("colPos"),
            total: t("colTotal"),
            filter: t("filterPos"),
          }}
          positionFilter={position}
          onPositionChange={setPosition}
          positionOptions={positionOptions}
        />
      ) : null}

      {ctx && tab === "compare" ? (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">
              {t("compareTitle")}
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
              {t("compareHint")}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <PlayerPicker
              label={t("playerA")}
              players={ctx.players}
              value={playerA}
              onChange={setPlayerA}
              excludeId={playerB}
            />
            <PlayerPicker
              label={t("playerB")}
              players={ctx.players}
              value={playerB}
              onChange={setPlayerB}
              excludeId={playerA}
            />
          </div>
          {compareLoading ? (
            <p className="text-sm text-slate-400">{t("loading")}</p>
          ) : null}
          {compare && playerA != null ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                <WcRadarChart
                  values={compare.a.values}
                  labels={compare.labels}
                  caption={`${compare.a.name} (${compare.a.team_code})`}
                  compare={
                    playerB != null && compare.b.id !== compare.a.id
                      ? {
                          values: compare.b.values,
                          name: compare.b.name,
                        }
                      : undefined
                  }
                />
              </div>
              {playerB != null && compare.b.id !== compare.a.id ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <h3 className="mb-2 text-sm font-semibold text-white">
                    {t("rawStats")}
                  </h3>
                  <div className="mb-2 grid grid-cols-3 gap-2 text-[10px] uppercase text-slate-500">
                    <span className="text-right text-brand-accent">{compare.a.name}</span>
                    <span className="text-center">{t("metric")}</span>
                    <span className="text-amber-300">{compare.b.name}</span>
                  </div>
                  <StatRow label="xG" a={compare.a.raw.xg} b={compare.b.raw.xg} />
                  <StatRow label="xA" a={compare.a.raw.xa} b={compare.b.raw.xa} />
                  <StatRow label={t("form")} a={compare.a.raw.form} b={compare.b.raw.form} />
                  <StatRow label={t("goals")} a={compare.a.raw.goals} b={compare.b.raw.goals} />
                  <StatRow
                    label={t("assists")}
                    a={compare.a.raw.assists}
                    b={compare.b.raw.assists}
                  />
                  <p className="mt-3 text-[11px] text-slate-500">{t("radarNote")}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
