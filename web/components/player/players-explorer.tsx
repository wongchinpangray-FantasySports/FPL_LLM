"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  InsightsSortableTh,
  sortInsightRows,
  useInsightsTableSort,
} from "@/components/fpl/insights/insights-table-sort";
import {
  FplPlayerPerformanceModal,
  type PlayerPerformanceProfile,
} from "@/components/fpl/insights/fpl-player-performance-modal";
import { PlayerRadarChart } from "@/components/player/player-radar-chart";
import type { PlayersExplorerRow } from "@/lib/fpl/players-explorer";
import type { PlayerRadarAxes } from "@/lib/player-hub";
import { minPlayerQueryLength } from "@/lib/fpl/player-search";

type SortKey =
  | "player"
  | "team"
  | "pos"
  | "price"
  | "own"
  | "xp"
  | "mins"
  | "threat"
  | "defcon90"
  | "value";

type PosFilter = "ALL" | "GKP" | "DEF" | "MID" | "FWD";

type Six = [number, number, number, number, number, number];

type CompareSlot = {
  fpl_id: number;
  label: string;
  position: string | null;
  values: Six;
};

type SearchHit = {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  position: string | null;
};

const PAGE_SIZE = 50;

function fmtNum(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

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

function sortValue(row: PlayersExplorerRow, key: SortKey): string | number | null {
  switch (key) {
    case "player":
      return row.web_name;
    case "team":
      return row.team;
    case "pos":
      return row.position;
    case "price":
      return row.price;
    case "own":
      return row.ownership;
    case "mins":
      return row.expected_minutes_next;
    case "threat":
      return row.threat;
    case "defcon90":
      return row.defensive_contribution_per_90;
    case "value":
      return row.value_per_million;
    case "xp":
    default:
      return row.xp_total;
  }
}

export function PlayersExplorer({
  rows,
  teams,
  horizon,
  fromGw,
  toGw,
  assessed,
}: {
  rows: PlayersExplorerRow[];
  teams: string[];
  horizon: number;
  fromGw: number;
  toGw: number;
  assessed: number;
}) {
  const t = useTranslations("playersIndex");
  const tPlayer = useTranslations("playerPage");
  const tModal = useTranslations("fplInsights.playerModal");
  const locale = useLocale();

  const [q, setQ] = useState("");
  const [pos, setPos] = useState<PosFilter>("ALL");
  const [team, setTeam] = useState("ALL");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { sortKey, sortDir, toggle } = useInsightsTableSort<SortKey>("xp");

  const [openId, setOpenId] = useState<number | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerPerformanceProfile | null>(null);

  const [compareA, setCompareA] = useState<CompareSlot | null>(null);
  const [compareB, setCompareB] = useState<CompareSlot | null>(null);
  const [compareQ, setCompareQ] = useState("");
  const [compareHits, setCompareHits] = useState<SearchHit[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRadar, setLoadingRadar] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const minP = minPrice.trim() === "" ? null : Number(minPrice);
    const maxP = maxPrice.trim() === "" ? null : Number(maxPrice);

    return rows.filter((row) => {
      if (pos !== "ALL" && row.position !== pos) return false;
      if (team !== "ALL" && row.team !== team) return false;
      if (minP != null && Number.isFinite(minP) && (row.price ?? 0) < minP) {
        return false;
      }
      if (maxP != null && Number.isFinite(maxP) && (row.price ?? 99) > maxP) {
        return false;
      }
      if (!needle) return true;
      return (
        row.web_name.toLowerCase().includes(needle) ||
        row.team.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, pos, team, minPrice, maxPrice]);

  const sorted = useMemo(
    () =>
      sortInsightRows(filtered, (row) => sortValue(row, sortKey), sortDir),
    [filtered, sortKey, sortDir],
  );

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [q, pos, team, minPrice, maxPrice, sortKey, sortDir]);

  const page = sorted.slice(0, visible);

  const openProfile = useCallback(
    async (fplId: number) => {
      setOpenId(fplId);
      setLoadingProfile(true);
      setProfileError(null);
      setDetail(null);
      try {
        const res = await fetch(
          `/api/player/${fplId}/profile?horizon=${horizon}`,
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error || tModal("error"));
        }
        setDetail((await res.json()) as PlayerPerformanceProfile);
      } catch (e) {
        setProfileError(e instanceof Error ? e.message : tModal("error"));
      } finally {
        setLoadingProfile(false);
      }
    },
    [horizon, tModal],
  );

  const closeProfile = useCallback(() => {
    setOpenId(null);
    setProfileError(null);
    setDetail(null);
    setLoadingProfile(false);
  }, []);

  const loadRadar = useCallback(async (fplId: number): Promise<CompareSlot | null> => {
    const res = await fetch(`/api/player/${fplId}/radar`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      radar: PlayerRadarAxes;
      label: string;
      position: string | null;
      fpl_id: number;
    };
    return {
      fpl_id: data.fpl_id,
      label: data.label,
      position: data.position,
      values: axesToTuple(data.radar),
    };
  }, []);

  const startCompare = useCallback(
    async (row: PlayersExplorerRow) => {
      setLoadingRadar(true);
      setCompareB(null);
      setCompareQ("");
      setCompareHits([]);
      try {
        const slot = await loadRadar(row.fpl_id);
        if (slot) setCompareA(slot);
        else {
          setCompareA({
            fpl_id: row.fpl_id,
            label: row.web_name,
            position: row.position,
            values: [0, 0, 0, 0, 0, 0],
          });
        }
      } finally {
        setLoadingRadar(false);
      }
    },
    [loadRadar],
  );

  const runCompareSearch = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed.length < minPlayerQueryLength(trimmed)) {
        setCompareHits([]);
        return;
      }
      setLoadingSearch(true);
      try {
        const params = new URLSearchParams({ q: trimmed, locale });
        const res = await fetch(`/api/planner/players?${params.toString()}`);
        const data = (await res.json()) as { players?: SearchHit[] };
        setCompareHits(
          (data.players ?? []).filter((p) => p.fpl_id !== compareA?.fpl_id),
        );
      } catch {
        setCompareHits([]);
      } finally {
        setLoadingSearch(false);
      }
    },
    [locale, compareA?.fpl_id],
  );

  useEffect(() => {
    if (!compareA) return;
    const id = window.setTimeout(() => {
      void runCompareSearch(compareQ);
    }, 220);
    return () => window.clearTimeout(id);
  }, [compareQ, compareA, runCompareSearch]);

  async function pickCompareB(hit: SearchHit) {
    setCompareQ("");
    setCompareHits([]);
    setLoadingRadar(true);
    try {
      const slot = await loadRadar(hit.fpl_id);
      if (slot) setCompareB(slot);
    } finally {
      setLoadingRadar(false);
    }
  }

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
      seasonSection: tPlayer("seasonSection"),
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
      colGw: tPlayer("tblGw"),
      colOpp: tPlayer("tblOpp"),
      colMins: tPlayer("tblMins"),
      colPts: tModal("colPts"),
      colXp: tPlayer("tblXp"),
      emptyGw: tModal("emptyGw"),
    }),
    [tModal, tPlayer],
  );

  const radarLabels: [string, string, string, string, string, string] = [
    tPlayer("radarForm"),
    tPlayer("radarGoalsP90"),
    tPlayer("radarAssistsP90"),
    tPlayer("radarDefconP90"),
    tPlayer("radarXgP90"),
    tPlayer("radarXaP90"),
  ];

  const posMismatch =
    compareA &&
    compareB &&
    compareA.position &&
    compareB.position &&
    compareA.position !== compareB.position;

  const positions: PosFilter[] = ["ALL", "GKP", "DEF", "MID", "FWD"];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        {t("explorerIntro", {
          count: assessed,
          from: fromGw,
          to: toGw,
          horizon,
        })}
      </p>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {positions.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPos(p)}
              className={
                pos === p
                  ? "rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-brand-ink"
                  : "rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {p === "ALL" ? t("filterAll") : p}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="players-filter-q"
              className="mb-1 block text-xs text-muted-foreground"
            >
              {t("searchLabel")}
            </label>
            <input
              id="players-filter-q"
              type="search"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("filterSearchPlaceholder")}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            />
          </div>
          <div>
            <label
              htmlFor="players-filter-team"
              className="mb-1 block text-xs text-muted-foreground"
            >
              {t("filterTeam")}
            </label>
            <select
              id="players-filter-team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            >
              <option value="ALL">{t("filterAllTeams")}</option>
              {teams.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="players-min-price"
                className="mb-1 block text-xs text-muted-foreground"
              >
                {t("filterMinPrice")}
              </label>
              <input
                id="players-min-price"
                type="number"
                step="0.5"
                min="3.5"
                max="15"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="4.0"
                className="w-full rounded-lg border border-border bg-input px-2 py-2 text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              />
            </div>
            <div>
              <label
                htmlFor="players-max-price"
                className="mb-1 block text-xs text-muted-foreground"
              >
                {t("filterMaxPrice")}
              </label>
              <input
                id="players-max-price"
                type="number"
                step="0.5"
                min="3.5"
                max="15"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="15.0"
                className="w-full rounded-lg border border-border bg-input px-2 py-2 text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("filterResultCount", { shown: page.length, total: sorted.length })}
        </p>
      </div>

      {compareA ? (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("compareTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("compareHint")}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCompareA(null);
                setCompareB(null);
                setCompareQ("");
                setCompareHits([]);
              }}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t("compareClear")}
            </button>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">{t("comparePlayerA")}: </span>
                <span className="font-medium">{compareA.label}</span>
                {compareA.position ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {compareA.position}
                  </span>
                ) : null}
              </p>

              <div>
                <label
                  htmlFor="players-compare-search"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  {t("compareSearchLabel")}
                </label>
                <input
                  id="players-compare-search"
                  type="search"
                  autoComplete="off"
                  value={compareQ}
                  onChange={(e) => setCompareQ(e.target.value)}
                  placeholder={t("compareSearchPlaceholder")}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                />
              </div>

              {loadingSearch ? (
                <p className="text-xs text-muted-foreground">
                  {t("searching")}
                </p>
              ) : compareHits.length > 0 ? (
                <ul className="max-h-40 overflow-y-auto rounded-lg border border-border bg-black/25 text-sm">
                  {compareHits.map((h) => {
                    const name = h.web_name ?? h.name ?? `#${h.fpl_id}`;
                    return (
                      <li
                        key={h.fpl_id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <button
                          type="button"
                          disabled={loadingRadar}
                          onClick={() => void pickCompareB(h)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                        >
                          <span className="font-medium">{name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {h.team ?? "—"} · {h.position ?? "—"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {compareB ? (
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">
                    {t("comparePlayerB")}:{" "}
                  </span>
                  <span className="font-medium text-amber-300">
                    {compareB.label}
                  </span>
                  {compareB.position ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {compareB.position}
                    </span>
                  ) : null}
                </p>
              ) : null}

              {posMismatch ? (
                <p className="text-xs text-amber-200/90">
                  {tPlayer("radarComparePosNote")}
                </p>
              ) : null}
              {loadingRadar ? (
                <p className="text-xs text-muted-foreground">
                  {t("compareLoading")}
                </p>
              ) : null}
            </div>

            {compareA ? (
              <div className="mx-auto w-full max-w-[280px] shrink-0">
                <PlayerRadarChart
                  values={compareA.values}
                  labels={radarLabels}
                  caption={
                    compareB
                      ? `${compareA.label} vs ${compareB.label}`
                      : compareA.label
                  }
                  compare={
                    compareB
                      ? { values: compareB.values, name: compareB.label }
                      : undefined
                  }
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("explorerEmpty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <InsightsSortableTh
                  label={t("colPlayer")}
                  active={sortKey === "player"}
                  dir={sortDir}
                  onSort={() => toggle("player")}
                />
                <InsightsSortableTh
                  label={t("colTeam")}
                  active={sortKey === "team"}
                  dir={sortDir}
                  onSort={() => toggle("team")}
                />
                <InsightsSortableTh
                  label={t("colPos")}
                  active={sortKey === "pos"}
                  dir={sortDir}
                  onSort={() => toggle("pos")}
                />
                <InsightsSortableTh
                  label={t("colPrice")}
                  active={sortKey === "price"}
                  dir={sortDir}
                  onSort={() => toggle("price")}
                />
                <InsightsSortableTh
                  label={t("colOwn")}
                  active={sortKey === "own"}
                  dir={sortDir}
                  onSort={() => toggle("own")}
                />
                <InsightsSortableTh
                  label={t("colXp")}
                  active={sortKey === "xp"}
                  dir={sortDir}
                  onSort={() => toggle("xp")}
                />
                <InsightsSortableTh
                  label={t("colMins")}
                  active={sortKey === "mins"}
                  dir={sortDir}
                  onSort={() => toggle("mins")}
                />
                <InsightsSortableTh
                  label={t("colThreat")}
                  active={sortKey === "threat"}
                  dir={sortDir}
                  onSort={() => toggle("threat")}
                />
                <InsightsSortableTh
                  label={t("colDefcon90")}
                  active={sortKey === "defcon90"}
                  dir={sortDir}
                  onSort={() => toggle("defcon90")}
                />
                <InsightsSortableTh
                  label={t("colValue")}
                  active={sortKey === "value"}
                  dir={sortDir}
                  onSort={() => toggle("value")}
                />
                <th className="px-3 py-2 font-medium">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {page.map((row) => (
                <tr
                  key={row.fpl_id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/20"
                >
                  <td className="px-3 py-2 font-medium text-foreground">
                    <button
                      type="button"
                      onClick={() => void openProfile(row.fpl_id)}
                      className="text-left hover:text-brand-accent hover:underline"
                    >
                      {row.web_name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.team}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.position ?? "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.price != null ? `£${row.price.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.ownership != null
                      ? `${fmtNum(row.ownership, 1)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {fmtNum(row.xp_total, 1)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtNum(row.expected_minutes_next, 0)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtNum(row.threat, 1)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtNum(row.defensive_contribution_per_90, 1)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtNum(row.value_per_million, 2)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void openProfile(row.fpl_id)}
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {t("actionProfile")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void startCompare(row)}
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {t("actionCompare")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visible < sorted.length ? (
        <button
          type="button"
          onClick={() => setVisible((n) => n + PAGE_SIZE)}
          className="self-center rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted/40"
        >
          {t("loadMore", { remaining: sorted.length - visible })}
        </button>
      ) : null}

      <FplPlayerPerformanceModal
        open={openId != null}
        loading={loadingProfile}
        error={profileError}
        detail={detail}
        labels={modalLabels}
        onClose={closeProfile}
      />
    </div>
  );
}
