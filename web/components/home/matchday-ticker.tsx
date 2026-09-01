"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  FplPlayerPerformanceModal,
  type PlayerPerformanceProfile,
} from "@/components/fpl/insights/fpl-player-performance-modal";
import type {
  MatchdayDetailPayload,
  MatchdayFixtureChip,
  MatchdayTickerPayload,
  MatchdayTopPlayer,
  MatchStatPlayer,
} from "@/lib/home/matchday";

function scoreLabel(f: MatchdayFixtureChip): string {
  if (f.home_score != null && f.away_score != null) {
    return `${f.home_score}–${f.away_score}`;
  }
  return "vs";
}

type TickerItem =
  | { type: "gw-label" }
  | { type: "fixture"; fixture: MatchdayFixtureChip }
  | { type: "top-label" }
  | { type: "top-player"; player: MatchdayTopPlayer; rank: number };

function tickerItemKey(item: TickerItem): string {
  switch (item.type) {
    case "gw-label":
      return "gw-label";
    case "fixture":
      return `fx-${item.fixture.fixture_id}`;
    case "top-label":
      return "top-label";
    case "top-player":
      return `tp-${item.player.fpl_id}`;
  }
}

function buildTickerItems(data: MatchdayTickerPayload): TickerItem[] {
  const items: TickerItem[] = [];
  if (data.gw != null) items.push({ type: "gw-label" });
  for (const fixture of data.fixtures) {
    items.push({ type: "fixture", fixture });
  }
  if (data.topPlayers.length > 0) items.push({ type: "top-label" });
  for (const [i, player] of data.topPlayers.entries()) {
    items.push({ type: "top-player", player, rank: i + 1 });
  }
  return items;
}

function StatList({
  title,
  empty,
  rows,
  valueOf,
  onPlayerClick,
}: {
  title: string;
  empty: string;
  rows: MatchStatPlayer[];
  valueOf: (p: MatchStatPlayer) => string;
  onPlayerClick?: (fplId: number) => void;
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {rows.map((p) => (
            <li
              key={`${title}-${p.fpl_id}`}
              className="flex items-baseline justify-between gap-2 text-sm"
            >
              {onPlayerClick ? (
                <button
                  type="button"
                  onClick={() => onPlayerClick(p.fpl_id)}
                  className="min-w-0 truncate text-left hover:text-brand-accent"
                >
                  <span className="font-medium text-foreground">{p.web_name}</span>
                  {p.team ? (
                    <span className="text-muted-foreground"> · {p.team}</span>
                  ) : null}
                </button>
              ) : (
                <span className="min-w-0 truncate">
                  <span className="font-medium text-foreground">{p.web_name}</span>
                  {p.team ? (
                    <span className="text-muted-foreground"> · {p.team}</span>
                  ) : null}
                </span>
              )}
              <span className="shrink-0 tabular-nums text-brand-accent">
                {valueOf(p)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchDetailModal({
  fixtureId,
  onClose,
  onPlayerClick,
}: {
  fixtureId: number;
  onClose: () => void;
  onPlayerClick: (fplId: number) => void;
}) {
  const t = useTranslations("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MatchdayDetailPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/home/matchday/${fixtureId}`)
      .then(async (res) => {
        const json = (await res.json()) as MatchdayDetailPayload & {
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? t("matchdayDetailError"));
        if (!cancelled) setDetail(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("matchdayDetailError"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureId, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const f = detail?.fixture;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="matchday-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label={t("matchdayClose")}
        onClick={onClose}
      />
      <div className="relative z-[101] flex max-h-[min(88vh,720px)] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="shrink-0 border-b border-border px-5 pb-4 pt-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-brand-accent">
            {f ? t("matchdayGw", { gw: String(f.gw) }) : t("matchdayDetailLoading")}
          </p>
          <h2
            id="matchday-detail-title"
            className="mt-1 text-lg font-semibold text-foreground"
          >
            {f
              ? `${f.home_name} ${scoreLabel(f)} ${f.away_name}`
              : t("matchdayDetailLoading")}
          </h2>
          {f ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {f.finished
                ? t("matchdayFinished")
                : f.started
                  ? t("matchdayLive")
                  : t("matchdayUpcoming")}
            </p>
          ) : null}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t("matchdayDetailLoading")}
            </p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : detail ? (
            <>
              <StatList
                title={t("matchdayScorers")}
                empty={t("matchdayNone")}
                rows={detail.scorers}
                valueOf={(p) =>
                  p.goals_scored > 1 ? String(p.goals_scored) : "1"
                }
                onPlayerClick={onPlayerClick}
              />
              <StatList
                title={t("matchdayAssists")}
                empty={t("matchdayNone")}
                rows={detail.assisters}
                valueOf={(p) => (p.assists > 1 ? String(p.assists) : "1")}
                onPlayerClick={onPlayerClick}
              />
              <StatList
                title={t("matchdayBps")}
                empty={t("matchdayNone")}
                rows={detail.bpsLeaders}
                valueOf={(p) => `${p.bps} BPS`}
                onPlayerClick={onPlayerClick}
              />
              <StatList
                title={t("matchdayBonus")}
                empty={t("matchdayNone")}
                rows={detail.bonusWinners}
                valueOf={(p) => `+${p.bonus}`}
                onPlayerClick={onPlayerClick}
              />
              <StatList
                title={t("matchdayDefcon")}
                empty={t("matchdayNone")}
                rows={detail.defcon}
                valueOf={(p) =>
                  p.defcon_points > 0
                    ? `${p.defensive_contribution} · +${p.defcon_points}`
                    : String(p.defensive_contribution)
                }
                onPlayerClick={onPlayerClick}
              />
            </>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {t("matchdayClose")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MatchdayTicker() {
  const t = useTranslations("home");
  const tPlayer = useTranslations("playerPage");
  const tModal = useTranslations("fplInsights.playerModal");
  const [data, setData] = useState<MatchdayTickerPayload | null>(null);
  const [openFixtureId, setOpenFixtureId] = useState<number | null>(null);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [playerDetail, setPlayerDetail] = useState<PlayerPerformanceProfile | null>(
    null,
  );
  const profileFetchRef = useRef(0);

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

  const openPlayerProfile = useCallback(
    async (fplId: number) => {
      const requestId = ++profileFetchRef.current;
      setOpenPlayerId(fplId);
      setLoadingProfile(true);
      setProfileError(null);
      setPlayerDetail(null);
      try {
        const res = await fetch(`/api/player/${fplId}/profile?horizon=5`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error || tModal("error"));
        }
        const profile = (await res.json()) as PlayerPerformanceProfile;
        if (profileFetchRef.current !== requestId) return;
        if (profile.fpl_id !== fplId) return;
        setPlayerDetail(profile);
      } catch (e) {
        if (profileFetchRef.current !== requestId) return;
        setProfileError(e instanceof Error ? e.message : tModal("error"));
      } finally {
        if (profileFetchRef.current === requestId) {
          setLoadingProfile(false);
        }
      }
    },
    [tModal],
  );

  const closePlayerProfile = useCallback(() => {
    profileFetchRef.current += 1;
    setOpenPlayerId(null);
    setProfileError(null);
    setPlayerDetail(null);
    setLoadingProfile(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/home/matchday")
      .then(async (res) => {
        const json = (await res.json()) as MatchdayTickerPayload & {
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "failed");
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;
  if (data.fixtures.length === 0 && data.topPlayers.length === 0) return null;

  const tickerItems = buildTickerItems(data);
  const marqueeItems = [...tickerItems, ...tickerItems];

  const activeProfile =
    playerDetail != null &&
    openPlayerId != null &&
    playerDetail.fpl_id === openPlayerId
      ? playerDetail
      : null;

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-border bg-card/50 py-2.5">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
        <div className="overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-3 px-4 animate-[marquee_55s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none">
            {marqueeItems.map((item, i) => {
              const key = `${i}-${tickerItemKey(item)}`;
              switch (item.type) {
                case "gw-label":
                  return (
                    <span
                      key={key}
                      className="inline-flex shrink-0 items-center rounded-full border border-brand-accent/30 bg-brand-accent/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-accent"
                    >
                      {t("matchdayGw", { gw: String(data.gw) })}
                    </span>
                  );
                case "fixture":
                  const f = item.fixture;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setOpenFixtureId(f.fixture_id)}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm no-underline transition-colors",
                        f.finished
                          ? "border-border bg-card/80 text-foreground hover:border-brand-accent/40"
                          : "border-emerald-500/30 bg-emerald-500/10 text-foreground hover:border-emerald-400/50",
                      )}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {f.finished ? t("matchdayResult") : t("matchdayLive")}
                      </span>
                      <span className="font-medium">
                        {f.home_short}{" "}
                        <span className="tabular-nums text-brand-accent">
                          {scoreLabel(f)}
                        </span>{" "}
                        {f.away_short}
                      </span>
                    </button>
                  );
                case "top-label":
                  return (
                    <span
                      key={key}
                      className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {t("matchdayTopXi")}
                    </span>
                  );
                case "top-player":
                  const p = item.player;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void openPlayerProfile(p.fpl_id)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-brand-accent/40"
                    >
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        #{item.rank} {p.position}
                      </span>
                      <span className="font-medium">{p.web_name}</span>
                      <span className="tabular-nums text-brand-accent">
                        {p.total_points}
                      </span>
                    </button>
                  );
              }
            })}
          </div>
        </div>
      </div>

      {openFixtureId != null ? (
        <MatchDetailModal
          fixtureId={openFixtureId}
          onClose={() => setOpenFixtureId(null)}
          onPlayerClick={(fplId) => void openPlayerProfile(fplId)}
        />
      ) : null}

      <FplPlayerPerformanceModal
        open={openPlayerId != null}
        loading={loadingProfile}
        error={profileError}
        detail={activeProfile}
        labels={modalLabels}
        onClose={closePlayerProfile}
      />
    </>
  );
}
