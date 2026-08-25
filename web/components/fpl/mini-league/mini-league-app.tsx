"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useEntryId } from "@/components/entry-id-context";
import { cn } from "@/lib/utils";
import type {
  MiniLeagueAnalysis,
  MiniLeagueFormat,
  MiniLeagueIndex,
  MiniLeagueManagerHistory,
  MiniLeaguePlayerRef,
  MiniLeagueRivalCompare,
  MiniLeagueStandingRow,
  MiniLeagueStandingsPage,
  RankMoveDir,
} from "@/lib/fpl/mini-league/types";
import { RivalNameButton, RivalSquadDialog } from "@/components/fpl/mini-league/rival-squad-dialog";
import { ManagerHistoryDialog } from "@/components/fpl/mini-league/manager-history-dialog";
import { MiniLeagueKillerTools } from "@/components/fpl/mini-league/mini-league-tools";
import {
  FplPlayerPerformanceModal,
  type PlayerPerformanceProfile,
} from "@/components/fpl/insights/fpl-player-performance-modal";

type MiniLeagueT = ReturnType<typeof useTranslations<"miniLeague">>;
type TabId = "overview" | "table" | "squad" | "transfers" | "moves";

function tr(t: MiniLeagueT, key: string): string {
  return t(key as Parameters<MiniLeagueT>[0]);
}

function qs(entryId: number | null, extra?: Record<string, string | number>): string {
  const p = new URLSearchParams();
  if (entryId) p.set("entry", String(entryId));
  if (extra) {
    for (const [key, value] of Object.entries(extra)) p.set(key, String(value));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

function leagueKey(format: MiniLeagueFormat, id: number): string {
  return `${format}:${id}`;
}

function parseLeagueKey(key: string | null): { format: MiniLeagueFormat; id: number } | null {
  if (!key) return null;
  const [format, idStr] = key.split(":");
  const id = Number(idStr);
  if ((format !== "classic" && format !== "h2h") || !Number.isFinite(id) || id <= 0) {
    return null;
  }
  return { format, id };
}

function formatPrice(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price)) return null;
  return `£${price.toFixed(1)}m`;
}

function playerBits(p: Pick<MiniLeaguePlayerRef, "team" | "position" | "price" | "fixture">, withPrice = false) {
  return [p.team, p.position, withPrice ? formatPrice(p.price) : null, p.fixture]
    .filter(Boolean)
    .join(" · ");
}

function rankLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function RankChip({ dir, delta }: { dir: RankMoveDir; delta: number | null }) {
  if (dir === "new") {
    return <span className="text-xs text-muted-foreground">NEW</span>;
  }
  if (dir === "same" || delta == null) {
    return <span className="text-xs text-muted-foreground">=</span>;
  }
  const up = dir === "up";
  return (
    <span
      className={cn(
        "tabular-nums text-xs font-semibold",
        up ? "text-emerald-400" : "text-rose-400",
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/60 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          accent ? "text-brand-accent" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PlayerLink({
  fplId,
  name,
  onInspect,
}: {
  fplId: number;
  name: string;
  onInspect: (fplId: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onInspect(fplId)}
      className="font-medium text-foreground hover:text-brand-accent"
    >
      {name}
    </button>
  );
}

function StandingsTable({
  rows,
  labels,
  h2h,
  onOpenSquad,
  onOpenHistory,
}: {
  rows: MiniLeagueStandingRow[];
  labels: {
    rank: string;
    team: string;
    manager: string;
    gw: string;
    total: string;
    squadDiff: string;
    you: string;
  };
  h2h: boolean;
  onOpenSquad: (row: MiniLeagueStandingRow) => void;
  onOpenHistory: (row: MiniLeagueStandingRow) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{labels.rank}</th>
            <th className="px-3 py-2 font-medium">{labels.team}</th>
            <th className="px-3 py-2 font-medium">{labels.manager}</th>
            <th className="px-3 py-2 text-right font-medium">{labels.gw}</th>
            <th className="px-3 py-2 text-right font-medium">{labels.total}</th>
            <th className="px-3 py-2 text-right font-medium">{labels.squadDiff}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.entry}
              className={cn(
                "border-t border-border/60",
                row.isYou && "bg-brand-accent/10",
              )}
            >
              <td className="px-3 py-2 tabular-nums">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.rank}</span>
                  <RankChip dir={row.rankDir} delta={row.rankDelta} />
                </div>
              </td>
              <td className="px-3 py-2">
                <RivalNameButton name={row.entryName} onClick={() => onOpenSquad(row)} />
                {row.isYou ? (
                  <span className="ml-1.5 rounded-full border border-brand-accent/30 bg-brand-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-accent">
                    {labels.you}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                <RivalNameButton
                  name={row.playerName}
                  onClick={() => onOpenHistory(row)}
                  className="font-normal text-muted-foreground"
                />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {h2h ? (row.pointsFor ?? row.eventTotal) : row.eventTotal}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{row.total}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {row.squadDiffPct == null ? "—" : `${row.squadDiffPct}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MiniLeagueApp({ linkedEntryId }: { linkedEntryId: number | null }) {
  const t = useTranslations("miniLeague");
  const tPlayer = useTranslations("playerPage");
  const tModal = useTranslations("fplInsights.playerModal");
  const { entryId: stored } = useEntryId();
  const [queryEntry, setQueryEntry] = useState<number | null>(null);
  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("entry");
      if (raw && /^\d+$/.test(raw)) setQueryEntry(Number(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const entryId =
    queryEntry ??
    linkedEntryId ??
    (stored && /^\d+$/.test(stored) ? Number(stored) : null);

  const [index, setIndex] = useState<MiniLeagueIndex | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MiniLeagueAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [tablePage, setTablePage] = useState(1);
  const [tableData, setTableData] = useState<MiniLeagueStandingsPage | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [rivalEntry, setRivalEntry] = useState<number | null>(null);
  const [rivalData, setRivalData] = useState<MiniLeagueRivalCompare | null>(null);
  const [rivalLoading, setRivalLoading] = useState(false);
  const [rivalError, setRivalError] = useState<string | null>(null);
  const [historyEntry, setHistoryEntry] = useState<number | null>(null);
  const [historyData, setHistoryData] = useState<MiniLeagueManagerHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectDetail, setInspectDetail] = useState<PlayerPerformanceProfile | null>(null);

  const selectedParsed = parseLeagueKey(selectedKey);
  const leagueId = selectedParsed?.id ?? null;
  const leagueFormat: MiniLeagueFormat = selectedParsed?.format ?? "classic";

  const loadIndex = useCallback(async () => {
    if (!entryId) {
      setIndexLoading(false);
      return;
    }
    setIndexLoading(true);
    setIndexError(null);
    try {
      const res = await fetch(`/api/fpl/mini-league${qs(entryId)}`);
      const data = (await res.json()) as MiniLeagueIndex & { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("errorLoad"));
      setIndex(data);
      setSelectedKey((prev) => {
        const parsed = parseLeagueKey(prev);
        if (parsed) {
          const list = parsed.format === "h2h" ? data.h2h : data.classic;
          if (list.some((l) => l.id === parsed.id)) return prev;
        }
        const firstMini = data.classic.find((l) => l.kind === "mini") ?? data.classic[0];
        if (firstMini) return leagueKey("classic", firstMini.id);
        if (data.h2h[0]) return leagueKey("h2h", data.h2h[0].id);
        return null;
      });
    } catch (err) {
      setIndexError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setIndexLoading(false);
    }
  }, [entryId, t]);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    if (!entryId || !leagueId) {
      setAnalysis(null);
      return;
    }
    let cancelled = false;
    setAnalysisLoading(true);
    setAnalysisError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/fpl/mini-league/${leagueId}${qs(entryId, { format: leagueFormat })}`,
        );
        const data = (await res.json()) as MiniLeagueAnalysis & { error?: string };
        if (!res.ok) throw new Error(data.error ?? t("errorAnalysis"));
        if (!cancelled) setAnalysis(data);
      } catch (err) {
        if (!cancelled) {
          setAnalysis(null);
          setAnalysisError(err instanceof Error ? err.message : t("errorAnalysis"));
        }
      } finally {
        if (!cancelled) setAnalysisLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId, leagueId, leagueFormat, t]);

  useEffect(() => {
    setTablePage(1);
    setTableData(null);
  }, [leagueId, leagueFormat]);

  useEffect(() => {
    if (!entryId || !leagueId || tab !== "table") return;
    let cancelled = false;
    setTableLoading(true);
    setTableError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/fpl/mini-league/${leagueId}/standings${qs(entryId, {
            page: tablePage,
            format: leagueFormat,
          })}`,
        );
        const data = (await res.json()) as MiniLeagueStandingsPage & { error?: string };
        if (!res.ok) throw new Error(data.error ?? t("errorStandings"));
        if (!cancelled) setTableData(data);
      } catch (err) {
        if (!cancelled) {
          setTableData(null);
          setTableError(err instanceof Error ? err.message : t("errorStandings"));
        }
      } finally {
        if (!cancelled) setTableLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId, leagueId, leagueFormat, tab, tablePage, t]);

  const openRival = useCallback(
    (rivalId: number) => {
      if (!entryId || !Number.isFinite(rivalId)) return;
      setHistoryEntry(null);
      setHistoryData(null);
      setHistoryError(null);
      setHistoryLoading(false);
      setInspectOpen(false);
      setInspectDetail(null);
      setInspectError(null);
      setInspectLoading(false);
      setRivalEntry(rivalId);
      setRivalData(null);
      setRivalError(null);
      setRivalLoading(true);
      void (async () => {
        try {
          const res = await fetch(
            `/api/fpl/mini-league/rival/${rivalId}${qs(entryId)}`,
          );
          const data = (await res.json()) as MiniLeagueRivalCompare & { error?: string };
          if (!res.ok) throw new Error(data.error ?? t("rivalError"));
          setRivalData(data);
        } catch (err) {
          setRivalError(err instanceof Error ? err.message : t("rivalError"));
        } finally {
          setRivalLoading(false);
        }
      })();
    },
    [entryId, t],
  );

  const closeRival = useCallback(() => {
    setRivalEntry(null);
    setRivalData(null);
    setRivalError(null);
    setRivalLoading(false);
  }, []);

  const openHistory = useCallback(
    (managerId: number) => {
      if (!entryId || !Number.isFinite(managerId)) return;
      closeRival();
      setHistoryEntry(managerId);
      setHistoryData(null);
      setHistoryError(null);
      setHistoryLoading(true);
      void (async () => {
        try {
          const res = await fetch(
            `/api/fpl/mini-league/history/${managerId}${qs(entryId)}`,
          );
          const data = (await res.json()) as MiniLeagueManagerHistory & { error?: string };
          if (!res.ok) throw new Error(data.error ?? t("historyError"));
          setHistoryData(data);
        } catch (err) {
          setHistoryError(err instanceof Error ? err.message : t("historyError"));
        } finally {
          setHistoryLoading(false);
        }
      })();
    },
    [closeRival, entryId, t],
  );

  const closeHistory = useCallback(() => {
    setHistoryEntry(null);
    setHistoryData(null);
    setHistoryError(null);
    setHistoryLoading(false);
  }, []);

  const closeInspect = useCallback(() => {
    setInspectOpen(false);
    setInspectLoading(false);
    setInspectError(null);
    setInspectDetail(null);
  }, []);

  const openInspect = useCallback(
    (fplId: number) => {
      if (!Number.isFinite(fplId) || fplId <= 0) return;
      setInspectOpen(true);
      setInspectLoading(true);
      setInspectError(null);
      setInspectDetail(null);
      void (async () => {
        try {
          const res = await fetch(`/api/player/${fplId}/profile?horizon=5`);
          const data = (await res.json()) as PlayerPerformanceProfile & {
            error?: string;
          };
          if (!res.ok) throw new Error(data.error ?? tModal("error"));
          setInspectDetail(data);
        } catch (err) {
          setInspectError(err instanceof Error ? err.message : tModal("error"));
        } finally {
          setInspectLoading(false);
        }
      })();
    },
    [tModal],
  );

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
      seasonSection: tModal("seasonSection", { season: "{season}" }),
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

  const selected = useMemo(() => {
    if (!index || !selectedParsed) return null;
    const list = selectedParsed.format === "h2h" ? index.h2h : index.classic;
    return list.find((l) => l.id === selectedParsed.id) ?? null;
  }, [index, selectedParsed]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: t("tabOverview") },
    { id: "table", label: t("tabTable") },
    { id: "squad", label: t("tabSquad") },
    { id: "transfers", label: t("tabTransfers") },
    { id: "moves", label: t("tabMoves") },
  ];

  if (!entryId) {
    return (
      <p className="rounded-xl border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        {t("needEntry")}
      </p>
    );
  }

  if (indexLoading) {
    return <p className="text-sm text-muted-foreground">{t("loadingLeagues")}</p>;
  }

  if (indexError) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {indexError}
      </p>
    );
  }

  if (!index?.classic.length && !index?.h2h.length) {
    return (
      <div className="rounded-xl border border-border bg-card/40 px-4 py-5">
        <p className="text-sm text-foreground">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {t("playingAs", { team: index?.teamName ?? `#${entryId}` })}
        </p>
        <label className="flex max-w-xl flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("leagueSelect")}
          </span>
          <select
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={selectedKey ?? ""}
            onChange={(e) => {
              setSelectedKey(e.target.value || null);
              setTablePage(1);
              setTableData(null);
              setTableError(null);
            }}
          >
            {index?.classic.length ? (
              <optgroup label={t("leagueClassic")}>
                {index.classic.map((league) => (
                  <option key={leagueKey("classic", league.id)} value={leagueKey("classic", league.id)}>
                    {`${league.name} · #${rankLabel(league.rank)}${league.kind === "public" ? ` · ${t("kindPublic")}` : ""}`}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {index?.h2h.length ? (
              <optgroup label={t("leagueH2h")}>
                {index.h2h.map((league) => (
                  <option key={leagueKey("h2h", league.id)} value={leagueKey("h2h", league.id)}>
                    {`${league.name} · #${rankLabel(league.rank)}`}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
        {selected ? (
          <p className="text-xs text-muted-foreground">
            {selected.format === "h2h" ? t("leagueH2h") : t("leagueClassic")}
            {selected.kind === "public" ? ` · ${t("kindPublic")}` : ""}
            {` · #${rankLabel(selected.rank)}`}
          </p>
        ) : null}
      </section>

      <nav className="flex flex-wrap gap-1.5" aria-label={t("tabsAria")}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
              tab === item.id
                ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/50",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {analysisLoading ? (
        <p className="text-sm text-muted-foreground">{t("loadingAnalysis")}</p>
      ) : null}
      {analysisError ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {analysisError}
        </p>
      ) : null}

      {tab === "table" || (analysis && !analysisLoading) ? (
        <>
          {tab === "overview" && analysis ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label={t("metricRank")}
                  value={`#${rankLabel(analysis.you?.rank ?? selected?.rank)}`}
                  hint={
                    analysis.memberCountExact
                      ? t("metricOf", { n: analysis.memberCount })
                      : t("metricOfAtLeast", { n: analysis.memberCount })
                  }
                  accent
                />
                <Metric
                  label={t("metricMove")}
                  value={
                    analysis.you
                      ? analysis.you.rankDir === "up"
                        ? `▲ ${analysis.you.rankDelta}`
                        : analysis.you.rankDir === "down"
                          ? `▼ ${Math.abs(analysis.you.rankDelta ?? 0)}`
                          : analysis.you.rankDir === "new"
                            ? t("moveNew")
                            : "="
                      : "—"
                  }
                  hint={t("metricLastRank", { n: rankLabel(analysis.you?.lastRank) })}
                />
                <Metric
                  label={t("metricGapLeader")}
                  value={
                    analysis.gapToLeader == null
                      ? "—"
                      : analysis.gapToLeader === 0
                        ? t("youLead")
                        : String(analysis.gapToLeader)
                  }
                  hint={analysis.leader ? analysis.leader.entryName : undefined}
                />
                <Metric
                  label={t("metricCatchNext")}
                  value={
                    analysis.pointsToCatchNext == null
                      ? t("alreadyFirst")
                      : String(analysis.pointsToCatchNext)
                  }
                  hint={t("metricPts")}
                />
              </div>
              {analysis.health.length ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">{t("healthTitle")}</h3>
                  <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                    {analysis.health.map((flag) => (
                      <li key={`${flag.fplId}-${flag.kind}`}>
                        <PlayerLink fplId={flag.fplId} name={flag.webName} onInspect={openInspect} />{" "}
                        <span className="text-amber-300">{tr(t, `health.${flag.kind}`)}</span>
                        {flag.note ? ` · ${flag.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("healthClear")}</p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <h3 className="text-sm font-semibold">{t("captainTitle")}</h3>
                  <p className="mt-2 text-sm">
                    {t("captainYours")}:{" "}
                    {analysis.captain.yours ? (
                      <PlayerLink
                        fplId={analysis.captain.yours.fplId}
                        name={analysis.captain.yours.webName}
                        onInspect={openInspect}
                      />
                    ) : (
                      "—"
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("captainLeague")}:{" "}
                    {analysis.captain.leagueTop ? (
                      <>
                        <PlayerLink
                          fplId={analysis.captain.leagueTop.fplId}
                          name={analysis.captain.leagueTop.webName}
                          onInspect={openInspect}
                        />
                        {` (${analysis.captain.leagueTop.captainOwners})`}
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <h3 className="text-sm font-semibold">{t("sampleNoteTitle")}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {analysis.sampleIncomplete
                      ? t("samplePartial", {
                          n: analysis.sampledManagers,
                          total: analysis.memberCount,
                        })
                      : t("sampleFull", { n: analysis.sampledManagers })}
                    {analysis.gw ? ` · GW${analysis.gw}` : ""}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "table" ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{t("tableHint")}</p>
              {tableError ? (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {tableError}
                </p>
              ) : null}
              {tableLoading && !tableData ? (
                <p className="text-sm text-muted-foreground">{t("loadingStandings")}</p>
              ) : null}
              {tableData ? (
                <>
                  <StandingsTable
                    rows={tableData.rows}
                    h2h={tableData.format === "h2h"}
                    onOpenSquad={(row) => openRival(row.entry)}
                    onOpenHistory={(row) => openHistory(row.entry)}
                    labels={{
                      rank: t("colRank"),
                      team: t("colTeam"),
                      manager: t("colManager"),
                      gw: tableData.format === "h2h" ? t("colPointsFor") : t("colGw"),
                      total: tableData.format === "h2h" ? t("colH2h") : t("colTotal"),
                      squadDiff: t("colSquadDiff"),
                      you: t("youBadge"),
                    }}
                  />
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      disabled={!tableData.hasPrev || tableLoading}
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      {t("pagePrev")}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {t("pageStatus", { n: tableData.page })}
                      {tableLoading ? ` · ${t("loadingStandings")}` : ""}
                    </p>
                    <button
                      type="button"
                      disabled={!tableData.hasNext || tableLoading}
                      onClick={() => setTablePage((p) => p + 1)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      {t("pageNext")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {tab === "squad" && analysis ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-border bg-card/40 p-4">
                <h3 className="text-sm font-semibold">{t("diffTitle")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t("diffHint")}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {analysis.differentials.length ? (
                    analysis.differentials.map((p) => (
                      <li key={p.fplId} className="flex items-baseline justify-between gap-3 text-sm">
                        <span>
                          <PlayerLink fplId={p.fplId} name={p.webName} onInspect={openInspect} />
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {playerBits(p)}
                          </span>
                        </span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {t("ownedBy", { n: p.owners })}
                          {p.xp != null ? ` · ${p.xp.toFixed(1)} xP` : ""}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">{t("diffEmpty")}</li>
                  )}
                </ul>
              </section>
              <section className="rounded-xl border border-border bg-card/40 p-4">
                <h3 className="text-sm font-semibold">{t("missingTitle")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t("missingHint")}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {analysis.missingTemplate.length ? (
                    analysis.missingTemplate.map((p) => (
                      <li key={p.fplId} className="flex items-baseline justify-between gap-3 text-sm">
                        <span>
                          <PlayerLink fplId={p.fplId} name={p.webName} onInspect={openInspect} />
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {playerBits(p)}
                          </span>
                        </span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {Math.round(p.ownerPct * 100)}%
                          {p.xp != null ? ` · ${p.xp.toFixed(1)} xP` : ""}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">{t("missingEmpty")}</li>
                  )}
                </ul>
              </section>
            </div>
          ) : null}

          {tab === "transfers" && analysis ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-border bg-card/40 p-4">
                <h3 className="text-sm font-semibold">{t("inTitle")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t("inHint")}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {analysis.transfersIn.length ? (
                    analysis.transfersIn.map((p) => (
                      <li key={p.fplId} className="flex items-baseline justify-between gap-3 text-sm">
                        <span>
                          <PlayerLink fplId={p.fplId} name={p.webName} onInspect={openInspect} />
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-brand-accent">
                            {tr(t, `inReason.${p.reason}`)}
                          </span>
                          {playerBits(p, true) ? (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {playerBits(p, true)}
                            </span>
                          ) : null}
                        </span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {t("aboveOwn", { n: p.ownersAbove })}
                          {p.xp != null ? ` · ${p.xp.toFixed(1)} xP` : ""}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">{t("inEmpty")}</li>
                  )}
                </ul>
              </section>
              <section className="rounded-xl border border-border bg-card/40 p-4">
                <h3 className="text-sm font-semibold">{t("outTitle")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t("outHint")}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {analysis.transfersOut.length ? (
                    analysis.transfersOut.map((p) => (
                      <li key={p.fplId} className="flex items-baseline justify-between gap-3 text-sm">
                        <span>
                          <PlayerLink fplId={p.fplId} name={p.webName} onInspect={openInspect} />
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-amber-300">
                            {tr(t, `outReason.${p.reason}`)}
                          </span>
                          {playerBits(p, true) ? (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {playerBits(p, true)}
                            </span>
                          ) : null}
                        </span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {p.xp != null ? `${p.xp.toFixed(1)} xP` : "—"}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">{t("outEmpty")}</li>
                  )}
                </ul>
              </section>
            </div>
          ) : null}

          {tab === "moves" && analysis ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t("movesHint")}</p>
              {analysis.movers.length ? (
                <ul className="flex flex-col gap-2">
                  {analysis.movers.map((row) => (
                    <li
                      key={row.entry}
                      className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-3 py-2 text-sm"
                    >
                      <span>
                        <RivalNameButton
                          name={row.entryName}
                          onClick={() => openRival(row.entry)}
                        />
                        <span className="ml-2 text-xs text-muted-foreground">#{row.rank}</span>
                      </span>
                      <RankChip dir={row.rankDir} delta={row.rankDelta} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("movesEmpty")}</p>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {index && leagueId ? (
        <MiniLeagueKillerTools
          entryId={entryId}
          leagueId={leagueId}
          leagueFormat={leagueFormat}
          analysis={analysis}
          index={index}
          onSelectLeague={(key) => {
            setSelectedKey(key);
            setTablePage(1);
            setTableData(null);
            setTableError(null);
          }}
          onInspect={openInspect}
          onOpenSquad={openRival}
        />
      ) : null}
      <RivalSquadDialog
        open={rivalEntry != null}
        data={rivalData}
        loading={rivalLoading}
        error={rivalError}
        onClose={closeRival}
        onInspectPlayer={openInspect}
      />
      <ManagerHistoryDialog
        open={historyEntry != null}
        data={historyData}
        loading={historyLoading}
        error={historyError}
        onClose={closeHistory}
      />
      <FplPlayerPerformanceModal
        open={inspectOpen}
        loading={inspectLoading}
        error={inspectError}
        detail={inspectDetail}
        labels={modalLabels}
        onClose={closeInspect}
      />
    </div>
  );
}
