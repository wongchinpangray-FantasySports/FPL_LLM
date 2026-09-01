"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PitchView, type PlannerGwStripCell, type PitchPriceBadge } from "@/components/planner/pitch-view";
import {
  FplPlayerPerformanceModal,
  type PlayerPerformanceProfile,
} from "@/components/fpl/insights/fpl-player-performance-modal";
import type { PlannerPickPayload } from "@/components/planner/types";
import type { PriceForecastStatus } from "@/lib/fpl/insights/price-forecast";
import { cn } from "@/lib/utils";

export type DashboardSquadPick = {
  fpl_id: number;
  slot: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  price: number | null;
  form: number | null;
  is_starter: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  availability_note?: string | null;
};

function toPlannerPicks(picks: DashboardSquadPick[]): PlannerPickPayload[] {
  return picks.map((p) => ({
    slot: p.slot,
    fpl_id: p.fpl_id,
    web_name: p.web_name ?? p.name,
    team: p.team,
    team_id: p.team_id,
    position: p.position,
    base_price: p.price,
    is_starter: p.is_starter,
    is_captain: p.is_captain,
    is_vice_captain: p.is_vice_captain,
  }));
}

function nextOppLabel(
  strip: PlannerGwStripCell[] | undefined,
): string | null {
  const cell = strip?.[0];
  if (!cell?.opp) return null;
  return cell.opp;
}

export function DashboardSquadPanel({
  picks,
  title,
  caption,
  benchLabel,
  horizon = 5,
  nextGwXpByFplId,
  gwForecastByFplId,
  priceForecastByFplId,
  inspectNameTitle = "View player summary",
}: {
  picks: DashboardSquadPick[];
  title: string;
  caption?: string;
  benchLabel: string;
  horizon?: number;
  nextGwXpByFplId?: Record<number, number>;
  gwForecastByFplId?: Record<number, PlannerGwStripCell[]>;
  priceForecastByFplId?: Record<
    number,
    {
      status: PriceForecastStatus;
      cost_change_event: number;
      progress: number;
    }
  >;
  inspectNameTitle?: string;
}) {
  const t = useTranslations("dashboard");
  const tPlayer = useTranslations("playerPage");
  const tModal = useTranslations("fplInsights.playerModal");
  const [viewMode, setViewMode] = useState<"pitch" | "list">("pitch");
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectDetail, setInspectDetail] =
    useState<PlayerPerformanceProfile | null>(null);

  const plannerPicks = useMemo(() => toPlannerPicks(picks), [picks]);
  const captainId = picks.find((p) => p.is_captain)?.fpl_id ?? null;
  const viceId = picks.find((p) => p.is_vice_captain)?.fpl_id ?? null;

  const modalLabels = useMemo(
    () => ({
      close: tModal("close"),
      loading: tModal("loading"),
      error: tModal("error"),
      openFullProfile: tModal("openFullProfile"),
      price: tPlayer("price"),
      form: tPlayer("form"),
      ownership: tPlayer("ownership"),
      status: tPlayer("status"),
      xpHorizon: tPlayer("xpHorizon"),
      valueXm: tPlayer("valueXm"),
      news: tPlayer("news"),
      seasonSection: tModal("seasonSection"),
      seasonLive: tModal("seasonLive"),
      totalPts: tPlayer("totalPts"),
      minutes: tPlayer("minutes"),
      goalsAssists: tPlayer("goalsAssists"),
      cleanSheets: tPlayer("cleanSheets"),
      ict: tPlayer("ict"),
      threat: tModal("threat"),
      defcon: tModal("defcon"),
      ppg: tModal("ppg"),
      recentTitle: tModal("recentTitle"),
      fixturesTitle: tModal("fixturesTitle"),
      colGw: tModal("colGw"),
      colOpp: tModal("colOpp"),
      colPlayedMins: tModal("colPlayedMins"),
      colMins: tModal("colMins"),
      colPts: tModal("colPts"),
      colXp: tModal("colXp"),
      colDcPts: tModal("colDcPts"),
      emptyGw: tModal("emptyGw"),
      priceForecast: {
        title: tModal("priceForecastTitle"),
        netTransfers: tModal("priceNetTransfers"),
        transfersInOut: tModal("priceTransfersInOut"),
        progress: tModal("priceProgress"),
        progressNext: tModal("priceProgressNext"),
        progressGwCumulative: tModal("priceProgressGwCumulative"),
        status: tModal("priceStatus"),
        alreadyUp: tModal("priceAlreadyUp"),
        alreadyDown: tModal("priceAlreadyDown"),
        statusLikelyRise: tModal("priceStatusLikelyRise"),
        statusWatchRise: tModal("priceStatusWatchRise"),
        statusLikelyFall: tModal("priceStatusLikelyFall"),
        statusWatchFall: tModal("priceStatusWatchFall"),
        statusStable: tModal("priceStatusStable"),
      },
    }),
    [tModal, tPlayer],
  );

  const cardSublineByFplId = useMemo(() => {
    const out: Record<number, string> = {};
    for (const p of picks) {
      const bits: string[] = [];
      const opp = nextOppLabel(gwForecastByFplId?.[p.fpl_id]);
      if (opp) bits.push(opp);
      if (p.price != null) bits.push(`£${p.price.toFixed(1)}m`);
      if (p.form != null) bits.push(`F ${p.form}`);
      if (p.availability_note) bits.push("⚠");
      if (bits.length) out[p.fpl_id] = bits.join(" · ");
    }
    return out;
  }, [picks, gwForecastByFplId]);

  const priceStatusLabel = (status: PriceForecastStatus): string => {
    switch (status) {
      case "likely_rise":
        return t("pitchPriceLikelyRise");
      case "watch_rise":
        return t("pitchPriceWatchRise");
      case "likely_fall":
        return t("pitchPriceLikelyFall");
      case "watch_fall":
        return t("pitchPriceWatchFall");
      default:
        return t("pitchPriceStable");
    }
  };

  const {
    priceBadgeByFplId,
    priceBadgeLabelByFplId,
    priceAlreadyChangedByFplId,
  } = useMemo(() => {
    const badges: Record<number, PitchPriceBadge> = {};
    const labels: Record<number, string> = {};
    const changed: Record<number, string | null> = {};
    if (!priceForecastByFplId) {
      return {
        priceBadgeByFplId: undefined,
        priceBadgeLabelByFplId: undefined,
        priceAlreadyChangedByFplId: undefined,
      };
    }
    for (const [idStr, snap] of Object.entries(priceForecastByFplId)) {
      const fplId = Number(idStr);
      badges[fplId] = {
        status: snap.status,
        cost_change_event: snap.cost_change_event,
        progress: snap.progress,
      };
      labels[fplId] = priceStatusLabel(snap.status);
      if (Math.abs(snap.cost_change_event) >= 0.05) {
        const n = Math.abs(snap.cost_change_event).toFixed(1);
        changed[fplId] =
          snap.cost_change_event > 0
            ? t("pitchPriceAlreadyUp", { n })
            : t("pitchPriceAlreadyDown", { n });
      } else {
        changed[fplId] = null;
      }
    }
    return {
      priceBadgeByFplId: badges,
      priceBadgeLabelByFplId: labels,
      priceAlreadyChangedByFplId: changed,
    };
  }, [priceForecastByFplId, t]);

  const openInspect = useCallback(
    async (fplId: number) => {
      setInspectOpen(true);
      setInspectLoading(true);
      setInspectError(null);
      setInspectDetail(null);
      try {
        const res = await fetch(
          `/api/player/${fplId}/profile?horizon=${horizon}`,
        );
        const data = (await res.json()) as PlayerPerformanceProfile & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? tModal("error"));
        }
        setInspectDetail(data);
      } catch (err) {
        setInspectError(
          err instanceof Error ? err.message : tModal("error"),
        );
      } finally {
        setInspectLoading(false);
      }
    },
    [horizon, tModal],
  );

  if (picks.length === 0) return null;

  const starters = picks.filter((p) => p.is_starter);
  const bench = picks.filter((p) => !p.is_starter);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card/60 p-0.5">
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "pitch"
                ? "bg-brand-accent/20 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setViewMode("pitch")}
          >
            {t("viewPitch")}
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "list"
                ? "bg-brand-accent/20 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setViewMode("list")}
          >
            {t("viewList")}
          </button>
        </div>
      </div>

      {viewMode === "pitch" ? (
        <PitchView
          picks={plannerPicks}
          title={title}
          caption={caption}
          captainId={captainId}
          viceId={viceId}
          interactive={false}
          benchLabel={benchLabel}
          cardSublineByFplId={cardSublineByFplId}
          gwForecastByFplId={gwForecastByFplId}
          nextGwXpByFplId={
            gwForecastByFplId ? undefined : nextGwXpByFplId
          }
          nextGwXpTitle="xP"
          onInspectPlayer={openInspect}
          inspectNameTitle={inspectNameTitle}
          priceBadgeByFplId={priceBadgeByFplId}
          priceBadgeLabelByFplId={priceBadgeLabelByFplId}
          priceAlreadyChangedByFplId={priceAlreadyChangedByFplId}
          gkAtTop
          appearance="showcase"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card/50">
          <SquadListTable
            rows={starters}
            sectionLabel={title}
            captainId={captainId}
            viceId={viceId}
            nextGwXpByFplId={nextGwXpByFplId}
            gwForecastByFplId={gwForecastByFplId}
            onInspect={openInspect}
          />
          <SquadListTable
            rows={bench}
            sectionLabel={benchLabel}
            captainId={captainId}
            viceId={viceId}
            nextGwXpByFplId={nextGwXpByFplId}
            gwForecastByFplId={gwForecastByFplId}
            onInspect={openInspect}
            muted
          />
        </div>
      )}

      <FplPlayerPerformanceModal
        open={inspectOpen}
        loading={inspectLoading}
        error={inspectError}
        detail={inspectDetail}
        labels={modalLabels}
        onClose={() => setInspectOpen(false)}
      />
    </>
  );
}

function SquadListTable({
  rows,
  sectionLabel,
  captainId,
  viceId,
  nextGwXpByFplId,
  gwForecastByFplId,
  onInspect,
  muted,
}: {
  rows: DashboardSquadPick[];
  sectionLabel: string;
  captainId: number | null;
  viceId: number | null;
  nextGwXpByFplId?: Record<number, number>;
  gwForecastByFplId?: Record<number, PlannerGwStripCell[]>;
  onInspect: (fplId: number) => void;
  muted?: boolean;
}) {
  const t = useTranslations("dashboard");
  if (rows.length === 0) return null;

  return (
    <div className={cn(muted && "border-t border-border/70 bg-muted/20")}>
      <div className="border-b border-border/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {sectionLabel}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("listPos")}</th>
              <th className="px-3 py-2 font-medium">{t("listPlayer")}</th>
              <th className="px-3 py-2 font-medium">{t("listTeam")}</th>
              <th className="px-3 py-2 font-medium">{t("listPrice")}</th>
              <th className="px-3 py-2 font-medium">{t("listForm")}</th>
              <th className="px-3 py-2 font-medium">{t("listNext")}</th>
              <th className="px-3 py-2 font-medium text-right">{t("listXp")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const xp = nextGwXpByFplId?.[p.fpl_id];
              const strip = gwForecastByFplId?.[p.fpl_id];
              const next = strip?.[0];
              const isC = captainId === p.fpl_id;
              const isV = viceId === p.fpl_id;
              return (
                <tr
                  key={p.fpl_id}
                  className="border-t border-border/50 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {p.position ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="font-medium text-foreground underline decoration-brand-accent/30 underline-offset-2 hover:text-brand-accent"
                      onClick={() => onInspect(p.fpl_id)}
                    >
                      {p.web_name ?? p.name ?? `#${p.fpl_id}`}
                    </button>
                    {isC ? (
                      <span className="ml-1.5 rounded bg-brand-accent/25 px-1 text-[10px] font-bold text-brand-accent">
                        C
                      </span>
                    ) : null}
                    {isV && !isC ? (
                      <span className="ml-1.5 rounded bg-white/15 px-1 text-[10px] text-foreground/70">
                        V
                      </span>
                    ) : null}
                    {p.availability_note ? (
                      <span
                        className="ml-1.5 text-[10px] text-amber-300"
                        title={p.availability_note}
                      >
                        ⚠
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.team ?? "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {p.price != null ? `£${p.price.toFixed(1)}m` : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {p.form != null ? p.form : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {next ? (
                      <span title={`GW${next.gw} · ${next.xp.toFixed(1)} xP`}>
                        {next.opp}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-brand-accent">
                    {xp != null && Number.isFinite(xp) ? xp.toFixed(1) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
