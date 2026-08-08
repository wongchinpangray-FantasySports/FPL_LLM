"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  InsightsSortableTh,
  sortInsightRows,
  type SortDir,
} from "@/components/fpl/insights/insights-table-sort";
import {
  FplPlayerPerformanceModal,
  type PlayerPerformanceProfile,
} from "@/components/fpl/insights/fpl-player-performance-modal";
import { PlayerRadarChart } from "@/components/player/player-radar-chart";
import type { PlayersExplorerRow } from "@/lib/fpl/players-explorer";
import type { PlayerRadarAxes } from "@/lib/player-hub";
import { minPlayerQueryLength } from "@/lib/fpl/player-search";
import { cn } from "@/lib/utils";

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

/** Optional table columns (player + actions always shown). */
type ColId =
  | "team"
  | "pos"
  | "price"
  | "own"
  | "xp"
  | "mins"
  | "threat"
  | "defcon90"
  | "value";

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
const COLS_STORAGE_KEY = "players-explorer-cols-v1";

const ALL_COLS: ColId[] = [
  "team",
  "pos",
  "price",
  "own",
  "xp",
  "mins",
  "threat",
  "defcon90",
  "value",
];

const DEFAULT_COLS_DESKTOP: ColId[] = [...ALL_COLS];
const DEFAULT_COLS_MOBILE: ColId[] = ["pos", "price", "xp", "mins"];

const SORT_KEYS = new Set<SortKey>([
  "player",
  "team",
  "pos",
  "price",
  "own",
  "xp",
  "mins",
  "threat",
  "defcon90",
  "value",
]);

const POS_FILTERS = new Set<PosFilter>(["ALL", "GKP", "DEF", "MID", "FWD"]);

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

function parsePos(raw: string | null): PosFilter {
  if (!raw) return "ALL";
  const u = raw.toUpperCase() as PosFilter;
  return POS_FILTERS.has(u) ? u : "ALL";
}

function parseSort(raw: string | null): SortKey {
  if (!raw) return "xp";
  return SORT_KEYS.has(raw as SortKey) ? (raw as SortKey) : "xp";
}

function parseDir(raw: string | null): SortDir {
  return raw === "asc" ? "asc" : "desc";
}

function parseId(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function parseCols(raw: string | null): ColId[] | null {
  if (!raw?.trim()) return null;
  const set = new Set<ColId>();
  for (const part of raw.split(",")) {
    const id = part.trim() as ColId;
    if (ALL_COLS.includes(id)) set.add(id);
  }
  return set.size > 0 ? ALL_COLS.filter((c) => set.has(c)) : null;
}

function colsEqual(a: ColId[], b: ColId[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((c, i) => c === b[i]);
}

function defaultColsForViewport(): ColId[] {
  if (typeof window === "undefined") return DEFAULT_COLS_DESKTOP;
  return window.matchMedia("(max-width: 639px)").matches
    ? DEFAULT_COLS_MOBILE
    : DEFAULT_COLS_DESKTOP;
}

function loadStoredCols(): ColId[] | null {
  try {
    const raw = localStorage.getItem(COLS_STORAGE_KEY);
    return parseCols(raw);
  } catch {
    return null;
  }
}

function saveStoredCols(cols: ColId[]) {
  try {
    localStorage.setItem(COLS_STORAGE_KEY, cols.join(","));
  } catch {
    /* ignore */
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const initialPos = parsePos(searchParams.get("pos"));
  const initialTeam = searchParams.get("team")?.trim() || "ALL";
  const initialQ = searchParams.get("q")?.trim() ?? "";
  const initialMin = searchParams.get("min")?.trim() ?? "";
  const initialMax = searchParams.get("max")?.trim() ?? "";
  const initialSort = parseSort(searchParams.get("sort"));
  const initialDir = parseDir(searchParams.get("dir"));
  const initialA = parseId(searchParams.get("a"));
  const initialB = parseId(searchParams.get("b"));
  const urlCols = parseCols(searchParams.get("cols"));

  const [q, setQ] = useState(initialQ);
  const [pos, setPos] = useState<PosFilter>(initialPos);
  const [team, setTeam] = useState(
    initialTeam !== "ALL" && teams.includes(initialTeam) ? initialTeam : "ALL",
  );
  const [minPrice, setMinPrice] = useState(initialMin);
  const [maxPrice, setMaxPrice] = useState(initialMax);
  const [sortKey, setSortKey] = useState<SortKey>(initialSort);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [colsOpen, setColsOpen] = useState(false);

  const [visibleCols, setVisibleCols] = useState<ColId[]>(() => {
    if (urlCols) return urlCols;
    return DEFAULT_COLS_DESKTOP;
  });
  const colsHydrated = useRef(false);

  useEffect(() => {
    if (colsHydrated.current) return;
    colsHydrated.current = true;
    if (urlCols) {
      setVisibleCols(urlCols);
      return;
    }
    const stored = loadStoredCols();
    setVisibleCols(stored ?? defaultColsForViewport());
  }, [urlCols]);

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
  const compareBootstrapped = useRef(false);

  const showCol = useCallback(
    (id: ColId) => visibleCols.includes(id),
    [visibleCols],
  );

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("desc");
      return key;
    });
  }, []);

  const toggleCol = useCallback((id: ColId) => {
    setVisibleCols((prev) => {
      const next = prev.includes(id)
        ? prev.filter((c) => c !== id)
        : ALL_COLS.filter((c) => prev.includes(c) || c === id);
      // Keep at least one metric column besides identity.
      if (next.length === 0) return prev;
      saveStoredCols(next);
      return next;
    });
  }, []);

  const resetCols = useCallback(() => {
    const next = defaultColsForViewport();
    setVisibleCols(next);
    saveStoredCols(next);
  }, []);

  // Sync shareable URL (debounced replace — no history spam).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (pos !== "ALL") params.set("pos", pos);
      if (team !== "ALL") params.set("team", team);
      if (q.trim()) params.set("q", q.trim());
      if (minPrice.trim()) params.set("min", minPrice.trim());
      if (maxPrice.trim()) params.set("max", maxPrice.trim());
      if (sortKey !== "xp") params.set("sort", sortKey);
      if (sortDir !== "desc") params.set("dir", sortDir);
      if (compareA) params.set("a", String(compareA.fpl_id));
      if (compareB) params.set("b", String(compareB.fpl_id));
      // Persist non-default column sets so shared links keep the same table.
      if (!colsEqual(visibleCols, DEFAULT_COLS_DESKTOP)) {
        params.set("cols", visibleCols.join(","));
      }

      const next = params.toString();
      const current = searchParams.toString();
      if (next === current) return;

      const href = next ? `${pathname}?${next}` : pathname;
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [
    pos,
    team,
    q,
    minPrice,
    maxPrice,
    sortKey,
    sortDir,
    compareA,
    compareB,
    visibleCols,
    pathname,
    router,
    searchParams,
  ]);

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

  // Bootstrap compare slots from ?a=&b=
  useEffect(() => {
    if (compareBootstrapped.current) return;
    if (initialA == null) {
      compareBootstrapped.current = true;
      return;
    }
    compareBootstrapped.current = true;
    let cancelled = false;
    (async () => {
      setLoadingRadar(true);
      try {
        const a = await loadRadar(initialA);
        if (cancelled) return;
        if (a) setCompareA(a);
        if (initialB != null && initialB !== initialA) {
          const b = await loadRadar(initialB);
          if (!cancelled && b) setCompareB(b);
        }
      } finally {
        if (!cancelled) setLoadingRadar(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialA, initialB, loadRadar]);

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

  const clearCompare = useCallback(() => {
    setCompareA(null);
    setCompareB(null);
    setCompareQ("");
    setCompareHits([]);
  }, []);

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

  const colLabel = useCallback(
    (id: ColId): string => {
      switch (id) {
        case "team":
          return t("colTeam");
        case "pos":
          return t("colPos");
        case "price":
          return t("colPrice");
        case "own":
          return t("colOwn");
        case "xp":
          return t("colXp");
        case "mins":
          return t("colMinsShort");
        case "threat":
          return t("colThreat");
        case "defcon90":
          return t("colDefcon90");
        case "value":
          return t("colValue");
      }
    },
    [t],
  );

  const posMismatch =
    compareA &&
    compareB &&
    compareA.position &&
    compareB.position &&
    compareA.position !== compareB.position;

  const positions: PosFilter[] = ["ALL", "GKP", "DEF", "MID", "FWD"];
  const metricColCount = visibleCols.length;
  const tableMinWidth =
    160 + metricColCount * 72 + 88; /* player + metrics + actions */

  const thClass = "px-2 py-1.5 sm:px-3 sm:py-2";
  const tdClass = "px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm";

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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {t("filterResultCount", {
              shown: page.length,
              total: sorted.length,
            })}
          </p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setColsOpen((o) => !o)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              aria-expanded={colsOpen}
            >
              {t("columnsButton")}
            </button>
            {colsOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-card p-3 shadow-lg">
                <p className="mb-2 text-xs font-medium text-foreground">
                  {t("columnsTitle")}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {ALL_COLS.map((id) => (
                    <li key={id}>
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/90">
                        <input
                          type="checkbox"
                          checked={showCol(id)}
                          onChange={() => toggleCol(id)}
                          className="rounded border-border"
                        />
                        {colLabel(id)}
                      </label>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={resetCols}
                  className="mt-3 text-xs text-primary underline-offset-2 hover:underline"
                >
                  {t("columnsReset")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {compareA ? (
        <section
          id="players-compare"
          className="rounded-xl border border-border bg-card p-3 sm:p-5"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("compareTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("compareHint")}</p>
            </div>
            <button
              type="button"
              onClick={clearCompare}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t("compareClear")}
            </button>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">
                  {t("comparePlayerA")}:{" "}
                </span>
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
                <p className="text-xs text-muted-foreground">{t("searching")}</p>
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

            <div className="mx-auto w-full max-w-[260px] shrink-0 sm:max-w-[280px]">
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
          </div>
        </section>
      ) : null}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("explorerEmpty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border -mx-1 px-1 sm:mx-0 sm:px-0">
          <table
            className="w-full border-collapse text-left"
            style={{ minWidth: tableMinWidth }}
          >
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
              <tr>
                <InsightsSortableTh
                  label={t("colPlayer")}
                  active={sortKey === "player"}
                  dir={sortDir}
                  onSort={() => toggleSort("player")}
                  className={thClass}
                />
                {showCol("team") ? (
                  <InsightsSortableTh
                    label={t("colTeam")}
                    active={sortKey === "team"}
                    dir={sortDir}
                    onSort={() => toggleSort("team")}
                    className={thClass}
                  />
                ) : null}
                {showCol("pos") ? (
                  <InsightsSortableTh
                    label={t("colPos")}
                    active={sortKey === "pos"}
                    dir={sortDir}
                    onSort={() => toggleSort("pos")}
                    className={thClass}
                  />
                ) : null}
                {showCol("price") ? (
                  <InsightsSortableTh
                    label={t("colPrice")}
                    active={sortKey === "price"}
                    dir={sortDir}
                    onSort={() => toggleSort("price")}
                    className={thClass}
                  />
                ) : null}
                {showCol("own") ? (
                  <InsightsSortableTh
                    label={t("colOwn")}
                    active={sortKey === "own"}
                    dir={sortDir}
                    onSort={() => toggleSort("own")}
                    className={thClass}
                  />
                ) : null}
                {showCol("xp") ? (
                  <InsightsSortableTh
                    label={t("colXp")}
                    active={sortKey === "xp"}
                    dir={sortDir}
                    onSort={() => toggleSort("xp")}
                    className={thClass}
                  />
                ) : null}
                {showCol("mins") ? (
                  <InsightsSortableTh
                    label={t("colMinsShort")}
                    active={sortKey === "mins"}
                    dir={sortDir}
                    onSort={() => toggleSort("mins")}
                    className={thClass}
                  />
                ) : null}
                {showCol("threat") ? (
                  <InsightsSortableTh
                    label={t("colThreat")}
                    active={sortKey === "threat"}
                    dir={sortDir}
                    onSort={() => toggleSort("threat")}
                    className={thClass}
                  />
                ) : null}
                {showCol("defcon90") ? (
                  <InsightsSortableTh
                    label={t("colDefcon90")}
                    active={sortKey === "defcon90"}
                    dir={sortDir}
                    onSort={() => toggleSort("defcon90")}
                    className={thClass}
                  />
                ) : null}
                {showCol("value") ? (
                  <InsightsSortableTh
                    label={t("colValue")}
                    active={sortKey === "value"}
                    dir={sortDir}
                    onSort={() => toggleSort("value")}
                    className={thClass}
                  />
                ) : null}
                <th className={cn(thClass, "font-medium")}>
                  <span className="sm:hidden">{t("colActionsShort")}</span>
                  <span className="hidden sm:inline">{t("colActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {page.map((row) => (
                <tr
                  key={row.fpl_id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/20"
                >
                  <td className={cn(tdClass, "font-medium text-foreground")}>
                    <button
                      type="button"
                      onClick={() => void openProfile(row.fpl_id)}
                      className="max-w-[7.5rem] truncate text-left hover:text-brand-accent hover:underline sm:max-w-none"
                      title={row.web_name}
                    >
                      {row.web_name}
                    </button>
                    {!showCol("team") ? (
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground sm:hidden">
                        {row.team}
                        {row.position ? ` · ${row.position}` : ""}
                      </span>
                    ) : null}
                  </td>
                  {showCol("team") ? (
                    <td className={cn(tdClass, "text-muted-foreground")}>
                      {row.team}
                    </td>
                  ) : null}
                  {showCol("pos") ? (
                    <td className={cn(tdClass, "text-muted-foreground")}>
                      {row.position ?? "—"}
                    </td>
                  ) : null}
                  {showCol("price") ? (
                    <td className={cn(tdClass, "tabular-nums")}>
                      {row.price != null ? `£${row.price.toFixed(1)}` : "—"}
                    </td>
                  ) : null}
                  {showCol("own") ? (
                    <td className={cn(tdClass, "tabular-nums")}>
                      {row.ownership != null
                        ? `${fmtNum(row.ownership, 1)}%`
                        : "—"}
                    </td>
                  ) : null}
                  {showCol("xp") ? (
                    <td className={cn(tdClass, "tabular-nums font-medium")}>
                      {fmtNum(row.xp_total, 1)}
                    </td>
                  ) : null}
                  {showCol("mins") ? (
                    <td className={cn(tdClass, "tabular-nums")}>
                      {fmtNum(row.expected_minutes_next, 0)}
                    </td>
                  ) : null}
                  {showCol("threat") ? (
                    <td className={cn(tdClass, "tabular-nums")}>
                      {fmtNum(row.threat, 1)}
                    </td>
                  ) : null}
                  {showCol("defcon90") ? (
                    <td className={cn(tdClass, "tabular-nums")}>
                      {fmtNum(row.defensive_contribution_per_90, 1)}
                    </td>
                  ) : null}
                  {showCol("value") ? (
                    <td className={cn(tdClass, "tabular-nums")}>
                      {fmtNum(row.value_per_million, 2)}
                    </td>
                  ) : null}
                  <td className={tdClass}>
                    <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-2">
                      <button
                        type="button"
                        onClick={() => void openProfile(row.fpl_id)}
                        className="text-left text-[11px] text-primary underline-offset-2 hover:underline sm:text-xs"
                      >
                        {t("actionProfile")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            await startCompare(row);
                            window.requestAnimationFrame(() => {
                              document
                                .getElementById("players-compare")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "nearest",
                                });
                            });
                          })();
                        }}
                        className="text-left text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:text-xs"
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
