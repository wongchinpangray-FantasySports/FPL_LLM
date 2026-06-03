"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { WcFdrRow, WcPlayerListItem, WcXpRow } from "@/lib/wc/data";
import type { WcScoutingReport } from "@/lib/wc/scouting";
import type { WcScoutArchetype } from "@/lib/wc/scouting";
import { WcAboutPanel } from "@/components/worldcup/wc-shared";
import { WcFdrGrid } from "@/components/worldcup/wc-fdr-grid";
import { WcXpHeatmap } from "@/components/worldcup/wc-xp-heatmap";
import { WcScoutingPanel } from "@/components/worldcup/wc-scouting-panel";

type Tab = "fdr" | "xp" | "scouting";

type ContextPayload = {
  fdrGrid: WcFdrRow[];
  xp: { matchdays: number[]; rows: WcXpRow[] };
  players: WcPlayerListItem[];
  disclaimer: string;
  pool_note?: string;
};

type ScoutingPayload = WcScoutingReport & { disclaimer?: string };

async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const snippet = text.trim().slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      res.ok
        ? "Server returned non-JSON response"
        : `HTTP ${res.status}: ${snippet || "request failed"}`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid JSON from server");
  }
}

export function WcFantasyApp() {
  const t = useTranslations("worldcup");
  const [tab, setTab] = useState<Tab>("fdr");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ContextPayload | null>(null);
  const [position, setPosition] = useState("ALL");
  const [scouting, setScouting] = useState<ScoutingPayload | null>(null);
  const [scoutingLoading, setScoutingLoading] = useState(false);
  const [scoutingError, setScoutingError] = useState<string | null>(null);

  const loadContext = useCallback(async (pos: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/worldcup/context?position=${encodeURIComponent(pos)}`,
      );
      const data = await readApiJson<ContextPayload & { error?: string }>(res);
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
    if (tab !== "scouting" || scouting != null) return;
    let cancelled = false;
    setScoutingLoading(true);
    setScoutingError(null);
    fetch("/api/worldcup/context?scouting=1")
      .then(async (res) => {
        const data = await readApiJson<{
          scouting?: ScoutingPayload;
          disclaimer?: string;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Scouting failed");
        if (!data.scouting) throw new Error("Scouting data missing");
        if (!cancelled) {
          setScouting({
            ...data.scouting,
            disclaimer: data.disclaimer ?? data.scouting.disclaimer,
          });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setScouting(null);
          setScoutingError(
            e instanceof Error ? e.message : "Scouting failed",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setScoutingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, scouting]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "fdr", label: t("tabFdr") },
    { id: "xp", label: t("tabXp") },
    { id: "scouting", label: t("tabScouting") },
  ];

  const positionOptions = [
    { value: "ALL", label: t("posAll") },
    { value: "GKP", label: t("posGkp") },
    { value: "DEF", label: t("posDef") },
    { value: "MID", label: t("posMid") },
    { value: "FWD", label: t("posFwd") },
  ];

  const matchdays = ctx?.xp.matchdays ?? [1, 2, 3];

  const archetypeLabels = {
    hidden_killer: {
      title: t("scoutHiddenKiller"),
      tagline: t("scoutHiddenKillerHint"),
    },
    unsung_hero: {
      title: t("scoutUnsungHero"),
      tagline: t("scoutUnsungHeroHint"),
    },
    silent_wall: {
      title: t("scoutSilentWall"),
      tagline: t("scoutSilentWallHint"),
    },
    indestructible_gate: {
      title: t("scoutIndestructibleGate"),
      tagline: t("scoutIndestructibleGateHint"),
    },
  } satisfies Record<WcScoutArchetype, { title: string; tagline: string }>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              tab === item.id
                ? "bg-brand-accent/15 text-brand-accent"
                : "text-slate-400 hover:text-white",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <WcAboutPanel
        poolNote={ctx?.pool_note}
        disclaimer={ctx?.disclaimer}
        scoutingNote={
          tab === "scouting" ? scouting?.disclaimer : undefined
        }
        moreLabel={t("aboutNotes")}
      />

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
          summary={t("fdrSummary")}
          detail={t("fdrDetail")}
          moreLabel={t("moreDetail")}
          labels={{
            team: t("colTeam"),
            group: t("colGroup"),
            expandHint: t("expandHint"),
            mdLabel: t("mdShort"),
          }}
        />
      ) : null}

      {ctx && tab === "xp" ? (
        <WcXpHeatmap
          rows={ctx.xp.rows}
          matchdays={matchdays}
          title={t("xpTitle")}
          summary={t("xpSummary")}
          detail={t("xpDetail")}
          labels={{
            player: t("colPlayer"),
            team: t("colTeam"),
            pos: t("colPos"),
            total: t("colTotal"),
            filter: t("filterPos"),
            expandHint: t("expandHint"),
            copyName: t("copyName"),
            copiedName: t("copiedName"),
            mdLabel: t("mdShort"),
          }}
          positionFilter={position}
          onPositionChange={setPosition}
          positionOptions={positionOptions}
        />
      ) : null}

      {tab === "scouting" ? (
        <>
          {scoutingError ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {scoutingError}
            </p>
          ) : null}
          {scoutingLoading && !scouting ? (
            <p className="text-sm text-slate-400">{t("loading")}</p>
          ) : null}
          {scouting ? (
            <WcScoutingPanel
              report={scouting}
              labels={{
                title: t("scoutingTitle"),
                summary: t("scoutingSummary"),
                detail: t("scoutingDetail"),
                moreDetail: t("moreDetail"),
                meta: t("scoutingMeta", {
                  scanned: scouting.scanned,
                  spotlight: scouting.excluded_spotlight,
                  popular: scouting.excluded_popular,
                }),
                archetypes: archetypeLabels,
                owned: t("colSelected"),
                xp: t("scoutXpShort"),
                gem: t("scoutGemShort"),
                empty: t("scoutEmpty"),
                expandHint: t("expandHint"),
                copyName: t("copyName"),
                copiedName: t("copiedName"),
                positions: {
                  FWD: t("posFwd"),
                  MID: t("posMid"),
                  DEF: t("posDef"),
                  GKP: t("posGkp"),
                },
                seasonClub: t("scoutSeasonClub"),
                seasonLeague: t("scoutSeasonLeague"),
                fplName: t("scoutFplName"),
                noClub: t("scoutNoClub"),
                sourceFpl: t("scoutSourceFpl"),
                sourceWikidata: t("scoutSourceWikidata"),
                sourceFootballData: t("scoutSourceFootballData"),
                fifaStats: t("scoutFifaStats"),
                goals: t("goals"),
                assists: t("assists"),
                minutes: t("scoutMinutes"),
                form: t("form"),
                xg: "xG",
                xa: "xA",
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
