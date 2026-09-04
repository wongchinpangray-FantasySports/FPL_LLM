"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PitchView,
  type PlannerFdrStripCell,
  type PlannerGwStripCell,
} from "@/components/planner/pitch-view";
import {
  FplPlayerPerformanceModal,
  type PlayerPerformanceProfile,
} from "@/components/fpl/insights/fpl-player-performance-modal";
import type { PlannerPickPayload } from "@/components/planner/types";
import type { SquadPlayerSignal } from "@/lib/transfers/diagnose";
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
  ownership: number | null;
  is_starter: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  availability_note?: string | null;
  /** Raw GW points for the selected points gameweek (no captain ×2). */
  gw_points?: number | null;
};

export type DashboardCardMetric =
  | "gw_pts"
  | "form"
  | "fdr3"
  | "ownership"
  | "xp";

const CARD_METRICS: DashboardCardMetric[] = [
  "gw_pts",
  "form",
  "fdr3",
  "ownership",
  "xp",
];

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

function cautionFromNote(note: string | null | undefined): SquadPlayerSignal | null {
  if (!note) return null;
  const lower = note.toLowerCase();
  let kind: SquadPlayerSignal["kinds"][number] = "doubtful";
  let severity: SquadPlayerSignal["severity"] = "watch";
  if (
    lower.includes("injur") ||
    lower.includes("受伤") ||
    lower.includes("伤停")
  ) {
    kind = "injured";
    severity = "alert";
  } else if (
    lower.includes("suspend") ||
    lower.includes("停赛") ||
    lower.includes("red card")
  ) {
    kind = "suspended";
    severity = "alert";
  } else if (
    lower.includes("unavail") ||
    lower.includes("不可用") ||
    lower.includes("not available")
  ) {
    kind = "unavailable";
    severity = "alert";
  }
  return {
    form: null,
    xp_horizon: null,
    severity,
    kinds: [kind],
    notes: [note],
  };
}

export function DashboardSquadPanel({
  picks,
  title,
  caption,
  benchLabel,
  horizon = 5,
  pointsGw = null,
  nextGwXpByFplId,
  gwForecastByFplId,
  fdrStripByFplId,
  inspectNameTitle = "View player summary",
}: {
  picks: DashboardSquadPick[];
  title: string;
  caption?: string;
  benchLabel: string;
  horizon?: number;
  /** GW number whose points are shown in GW pts mode */
  pointsGw?: number | null;
  nextGwXpByFplId?: Record<number, number>;
  gwForecastByFplId?: Record<number, PlannerGwStripCell[]>;
  fdrStripByFplId?: Record<number, PlannerFdrStripCell[]>;
  inspectNameTitle?: string;
}) {
  const t = useTranslations("dashboard");
  const tPlayer = useTranslations("playerPage");
  const tModal = useTranslations("fplInsights.playerModal");
  const [viewMode, setViewMode] = useState<"pitch" | "list">("pitch");
  const [cardMetric, setCardMetric] = useState<DashboardCardMetric>("gw_pts");
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

  const attentionByFplId = useMemo(() => {
    const out: Record<number, SquadPlayerSignal> = {};
    for (const p of picks) {
      const signal = cautionFromNote(p.availability_note);
      if (signal) out[p.fpl_id] = signal;
    }
    return out;
  }, [picks]);

  const primaryMetricTitle = useMemo(() => {
    switch (cardMetric) {
      case "gw_pts":
        return pointsGw != null
          ? t("cardMetricGwPtsTitle", { gw: pointsGw })
          : t("cardMetricGwPts");
      case "form":
        return t("cardMetricForm");
      case "ownership":
        return t("cardMetricOwn");
      case "xp":
        return t("cardMetricXp");
      default:
        return undefined;
    }
  }, [cardMetric, pointsGw, t]);

  const primaryMetricByFplId = useMemo(() => {
    if (cardMetric === "fdr3") return undefined;
    const out: Record<number, string> = {};
    for (const p of picks) {
      if (cardMetric === "gw_pts") {
        out[p.fpl_id] =
          p.gw_points != null && Number.isFinite(p.gw_points)
            ? String(Math.round(p.gw_points))
            : "—";
      } else if (cardMetric === "form") {
        out[p.fpl_id] =
          p.form != null && Number.isFinite(p.form) ? p.form.toFixed(1) : "—";
      } else if (cardMetric === "ownership") {
        out[p.fpl_id] =
          p.ownership != null && Number.isFinite(p.ownership)
            ? `${p.ownership.toFixed(1)}%`
            : "—";
      } else if (cardMetric === "xp") {
        const xp = nextGwXpByFplId?.[p.fpl_id];
        const base =
          xp != null && Number.isFinite(xp)
            ? p.is_starter && p.is_captain
              ? xp * 2
              : xp
            : null;
        out[p.fpl_id] =
          base != null ? base.toFixed(1) : "—";
      }
    }
    return out;
  }, [cardMetric, picks, nextGwXpByFplId]);

  const activeFdrStrip =
    cardMetric === "fdr3" ? fdrStripByFplId : undefined;

  const cardSublineByFplId = useMemo(() => {
    const out: Record<number, string> = {};
    for (const p of picks) {
      const bits: string[] = [];
      const opp = nextOppLabel(gwForecastByFplId?.[p.fpl_id]);
      if (opp) bits.push(opp);
      if (p.price != null) bits.push(`£${p.price.toFixed(1)}m`);
      if (bits.length) out[p.fpl_id] = bits.join(" · ");
    }
    return out;
  }, [picks, gwForecastByFplId]);

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

  const pitchCaption =
    cardMetric === "gw_pts"
      ? t("squadPitchCaptionMetric", {
          metric: pointsGw != null
            ? t("cardMetricGwPtsTitle", { gw: pointsGw })
            : t("cardMetricGwPts"),
        })
      : t("squadPitchCaptionMetric", {
          metric: t(
            cardMetric === "form"
              ? "cardMetricForm"
              : cardMetric === "fdr3"
                ? "cardMetricFdr"
                : cardMetric === "ownership"
                  ? "cardMetricOwn"
                  : "cardMetricXp",
          ),
        });

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

        {viewMode === "pitch" ? (
          <div
            className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-card/60 p-0.5"
            role="group"
            aria-label={t("cardMetricLabel")}
          >
            {CARD_METRICS.map((m) => (
              <button
                key={m}
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:text-xs",
                  cardMetric === m
                    ? "bg-brand-accent/20 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setCardMetric(m)}
              >
                {m === "gw_pts"
                  ? t("cardMetricGwPts")
                  : m === "form"
                    ? t("cardMetricForm")
                    : m === "fdr3"
                      ? t("cardMetricFdr")
                      : m === "ownership"
                        ? t("cardMetricOwn")
                        : t("cardMetricXp")}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {viewMode === "pitch" ? (
        <PitchView
          picks={plannerPicks}
          title={title}
          caption={pitchCaption}
          captainId={captainId}
          viceId={viceId}
          interactive={false}
          benchLabel={benchLabel}
          cardSublineByFplId={
            cardMetric === "fdr3" ? undefined : cardSublineByFplId
          }
          fdrStripByFplId={activeFdrStrip}
          primaryMetricByFplId={primaryMetricByFplId}
          primaryMetricTitle={primaryMetricTitle}
          nextGwXpByFplId={undefined}
          onInspectPlayer={openInspect}
          inspectNameTitle={inspectNameTitle}
          attentionByFplId={attentionByFplId}
          showAttentionLegend
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
            pointsGw={pointsGw}
            nextGwXpByFplId={nextGwXpByFplId}
            gwForecastByFplId={gwForecastByFplId}
            onInspect={openInspect}
          />
          <SquadListTable
            rows={bench}
            sectionLabel={benchLabel}
            captainId={captainId}
            viceId={viceId}
            pointsGw={pointsGw}
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
  pointsGw,
  nextGwXpByFplId,
  gwForecastByFplId,
  onInspect,
  muted,
}: {
  rows: DashboardSquadPick[];
  sectionLabel: string;
  captainId: number | null;
  viceId: number | null;
  pointsGw?: number | null;
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
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("listPos")}</th>
              <th className="px-3 py-2 font-medium">{t("listPlayer")}</th>
              <th className="px-3 py-2 font-medium">{t("listTeam")}</th>
              <th className="px-3 py-2 font-medium">{t("listPrice")}</th>
              <th className="px-3 py-2 font-medium">{t("listForm")}</th>
              <th className="px-3 py-2 font-medium">
                {pointsGw != null
                  ? t("listGwPts", { gw: pointsGw })
                  : t("cardMetricGwPts")}
              </th>
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
                  <td className="px-3 py-2 font-semibold tabular-nums text-brand-accent">
                    {p.gw_points != null && Number.isFinite(p.gw_points)
                      ? Math.round(p.gw_points)
                      : "—"}
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
