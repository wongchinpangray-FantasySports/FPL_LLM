"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { minPlayerQueryLength } from "@/lib/fpl/player-search";
import type { NextFixtureOpponent } from "@/lib/xp";
import { findBestXiByXp } from "@/lib/planner/optimize-xi";
import type { ValidationIssue } from "@/lib/planner/validate";
import type {
  PlannerTopPosition,
  TopXpPlayerRow,
} from "@/lib/planner/top-xp-by-position";
import { PlannerTopXpSidebar } from "@/components/planner/planner-top-xp-sidebar";
import {
  PlannerChangesStrip,
  type SquadChangeEntry,
} from "@/components/planner/planner-changes-strip";
import {
  swapBudget,
  validatePlannerSquad,
  validateXiFormation,
} from "@/lib/planner/validate";
import {
  pitchExportPixelRatio,
  preparePitchForPngExport,
} from "@/lib/planner/prepare-pitch-png-export";
import { PlannerDiagnosePanel } from "@/components/transfers/diagnose-panel";
import type {
  DiagnoseResult,
  SquadPlayerSignal,
  TransferSuggestion,
} from "@/lib/transfers/diagnose";

function formatPlannerIssue(
  issue: ValidationIssue,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const v = issue.values;
  switch (issue.code) {
    case "size":
      return t("valSize", { have: Number(v?.have ?? 0) });
    case "club_cap":
      return t("valClubCap", {
        teamId: Number(v?.teamId ?? 0),
        n: Number(v?.n ?? 0),
      });
    case "xi_size":
      return t("valXiSize", { have: Number(v?.have ?? 0) });
    case "xi_gk":
      return t("valXiGk", { gk: Number(v?.gk ?? 0) });
    case "xi_def":
      return t("valXiDef", { d: Number(v?.d ?? 0) });
    case "xi_mid":
      return t("valXiMid", { m: Number(v?.m ?? 0) });
    case "xi_fwd":
      return t("valXiFwd", { f: Number(v?.f ?? 0) });
    case "xi_sum":
      return t("valXiSum");
    default:
      if (issue.code.startsWith("pos_")) {
        return t("valPos", {
          pos: String(v?.pos ?? issue.code.slice(4)),
          need: Number(v?.need ?? 0),
          have: Number(v?.have ?? 0),
        });
      }
      return issue.message;
  }
}
import {
  PlannerPlayerInspectSheet,
  type PlannerPlayerInspectDetail,
} from "@/components/planner/planner-player-inspect";
import {
  PitchView,
  type PlannerGwStripCell,
} from "@/components/planner/pitch-view";
import type { PlannerPickPayload } from "@/components/planner/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { readJsonResponse, apiErrorMessage } from "@/lib/fetch-json";
import {
  PlannerScenarioTabs,
  type PlannerViewTab,
} from "@/components/planner/planner-scenario-tabs";
import {
  SquadBuilderPlayerPanel,
  type BrowsePlayer,
} from "@/components/squad-builder/squad-builder-player-panel";
import { slotPosition } from "@/lib/squad-builder/slots";
import {
  createScenarioDraftFromBaseline,
  hydrateScenarioDraftFromAccount,
  resolveScenarioSlot,
  saveScenarioDraftAccount,
  saveScenarioDraftLocal,
  scenarioHorizonXpt,
  scenarioIndexRange,
  upsertScenarioSlot,
  type PlannerScenarioDraftV1,
  type PlannerScenarioSlot,
  type ScenarioIndex,
} from "@/lib/planner/scenario-draft";

export type { PlannerPickPayload } from "@/components/planner/types";

type Row = PlannerPickPayload;

type SearchPlayer = {
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

type ProjRow = {
  xp_total: number;
  xp_per_game: number;
  xp_next_gw?: number;
  web_name: string | null;
  position: string | null;
  team: string | null;
  by_gw?: { gw: number; opp: string; xp: number }[];
};

function useMinLg(): boolean {
  const [lg, setLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setLg(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return lg;
}

function browseToSearchPlayer(p: BrowsePlayer): SearchPlayer {
  return {
    fpl_id: p.fpl_id,
    web_name: p.web_name,
    name: p.name,
    team: p.team,
    team_id: p.team_id,
    position: p.position,
    base_price: p.base_price,
    status: "a",
    form: p.form,
    total_points: p.total_points,
    minutes: null,
    selected_by_percent: p.selected_by_percent,
    points_per_game: null,
    ict_index: null,
    goals_scored: null,
    assists: null,
    expected_goals: null,
    expected_assists: null,
  };
}

function baselineScenarioSlot(
  picks: PlannerPickPayload[],
  bank: number,
  captainId: number | null,
  viceId: number | null,
): PlannerScenarioSlot {
  return {
    picks: picks.map((p) => ({ ...p })),
    captainId,
    viceId,
    bank,
  };
}

function projectionIdUnion(
  draft: PlannerScenarioDraftV1,
  currentPicks: Row[],
  baseline: Row[],
): number[] {
  const ids = new Set<number>();
  for (const p of baseline) ids.add(p.fpl_id);
  for (const p of currentPicks) ids.add(p.fpl_id);
  for (const i of scenarioIndexRange()) {
    for (const p of resolveScenarioSlot(draft, i).picks) {
      if (p.fpl_id > 0) ids.add(p.fpl_id);
    }
  }
  return Array.from(ids);
}

const PROJ_CHUNK_MAX = 45;
const PROJ_CHUNK_MIN = 15;

/** Split ids for /api/planner/project (15–45 per request). */
function chunkPlayerIdsForProject(
  ids: number[],
  padFrom: number[],
): number[][] {
  const uniq = Array.from(new Set(ids.filter((id) => id > 0)));
  if (uniq.length === 0) return [];

  const pad = padFrom.filter((id) => id > 0);
  const ensureMin = (chunk: number[]) => {
    if (chunk.length >= PROJ_CHUNK_MIN) return chunk.slice(0, PROJ_CHUNK_MAX);
    return Array.from(new Set([...chunk, ...pad])).slice(0, PROJ_CHUNK_MAX);
  };

  if (uniq.length <= PROJ_CHUNK_MAX) {
    const chunk = ensureMin(uniq);
    return chunk.length >= PROJ_CHUNK_MIN ? [chunk] : [];
  }

  const chunks: number[][] = [];
  for (let i = 0; i < uniq.length; i += PROJ_CHUNK_MAX) {
    chunks.push(ensureMin(uniq.slice(i, i + PROJ_CHUNK_MAX)));
  }
  return chunks;
}

type ProjectApiResponse = {
  projections?: Record<string, ProjRow>;
  fromGw?: number;
  toGw?: number;
  horizon?: number;
  leagueTops?: {
    tops?: Record<PlannerTopPosition, TopXpPlayerRow[]>;
    fromGw?: number;
    toGw?: number;
    horizon?: number;
  } | null;
  error?: string;
};
function pitchSecondLineFromNext(
  row: PlannerPickPayload,
  nextByFplId: Record<number, NextFixtureOpponent | null | undefined>,
): string {
  const n = nextByFplId[row.fpl_id];
  if (n) return `${n.opp_short}${n.home ? "(H)" : "(A)"}`;
  return row.team ?? "–";
}

export function PlannerApp({
  entryId,
  entryName,
  initialBank,
  initialPicks,
  baselineKey,
  teams = [],
  baselineBanner = null,
  squadToggle = null,
  initialSuggestOpen = false,
  pendingApply = null,
}: {
  entryId: number;
  entryName: string;
  initialBank: number;
  initialPicks: PlannerPickPayload[];
  /** FPL squad fingerprint — resets saved scenarios when it changes. */
  baselineKey: string;
  teams?: { id: number; short_name: string; name: string }[];
  /** Shown when Free Hit active: explains revert vs temp 15 */
  baselineBanner?: string | null;
  /** Links to switch ?squad=freehit vs default */
  squadToggle?: {
    useFreeHit: boolean;
    pathBase: string;
  } | null;
  /** Open diagnose suggestions panel (e.g. ?suggest=1) */
  initialSuggestOpen?: boolean;
  /** Auto-apply out→in once diagnose loads (?out=&in=) */
  pendingApply?: { outId: number; inId: number } | null;
}) {
  const t = useTranslations("plannerApp");
  const tsb = useTranslations("squadBuilderApp");
  const locale = useLocale();
  const router = useRouter();
  const isLg = useMinLg();
  const [pendingApplyState, setPendingApplyState] = useState(pendingApply);
  const [diagnoseData, setDiagnoseData] = useState<DiagnoseResult | null>(null);

  const sortedInitial = useMemo(
    () => [...initialPicks].sort((a, b) => a.slot - b.slot),
    [initialPicks],
  );

  const [picks, setPicks] = useState<Row[]>(sortedInitial);
  const [bank, setBank] = useState(initialBank);
  const cap0 =
    sortedInitial.find((p) => p.is_captain)?.fpl_id ??
    sortedInitial[0]?.fpl_id ??
    null;
  const vice0 =
    sortedInitial.find((p) => p.is_vice_captain)?.fpl_id ?? null;
  const [captainId, setCaptainId] = useState<number | null>(cap0);
  const [viceId, setViceId] = useState<number | null>(vice0);

  const [scenarioDraft, setScenarioDraft] = useState<PlannerScenarioDraftV1>(() =>
    createScenarioDraftFromBaseline(
      entryId,
      baselineKey,
      sortedInitial,
      initialBank,
      cap0,
      vice0,
    ),
  );
  const [viewTab, setViewTab] = useState<PlannerViewTab>(1);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const [swapSlot, setSwapSlot] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  /** Shown inside the replace-player modal when a pick would break FPL squad rules */
  const [swapNotice, setSwapNotice] = useState<string | null>(null);
  const [swapRecs, setSwapRecs] = useState<
    import("@/lib/planner/swap-recommendations").SwapRecommendation[]
  >([]);
  const [swapRecsLoading, setSwapRecsLoading] = useState(false);

  const [horizon, setHorizon] = useState(5);
  /** Separate draft so clearing / retyping GW count works on mobile (controlled number would snap back). */
  const [horizonDraft, setHorizonDraft] = useState("5");
  const [projById, setProjById] = useState<Record<string, ProjRow>>({});
  const [projMeta, setProjMeta] = useState<{
    fromGw: number;
    toGw: number;
  } | null>(null);
  const [projLoading, setProjLoading] = useState(false);
  const [projError, setProjError] = useState<string | null>(null);

  const [topsByPos, setTopsByPos] = useState<Record<
    PlannerTopPosition,
    TopXpPlayerRow[]
  > | null>(null);
  const [topsFromGw, setTopsFromGw] = useState<number | null>(null);
  const [topsToGw, setTopsToGw] = useState<number | null>(null);
  const [topsHorizon, setTopsHorizon] = useState<number | null>(null);
  const [topsLoading, setTopsLoading] = useState(false);
  const [topsError, setTopsError] = useState<string | null>(null);

  /** Next opponent per player (from /api/planner/next-fixtures); cards default to this line. */
  const [nextFixtureByFplId, setNextFixtureByFplId] = useState<
    Record<number, NextFixtureOpponent | null | undefined>
  >({});

  /** Bench ↔ XI two-tap mode (no transfers) */
  const [xiBenchMode, setXiBenchMode] = useState(false);
  const [xiFirst, setXiFirst] = useState<number | null>(null);

  /** Player profile / fixture outlook sheet */
  const [inspectCtx, setInspectCtx] = useState<{
    side: "baseline" | "scenario";
    slot: number;
    fplId: number;
  } | null>(null);
  const [inspectDetail, setInspectDetail] =
    useState<PlannerPlayerInspectDetail | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectErr, setInspectErr] = useState<string | null>(null);

  useEffect(() => {
    if (viceId != null && captainId != null && viceId === captainId) {
      setViceId(null);
    }
  }, [captainId, viceId]);

  useEffect(() => {
    setTopsByPos(null);
    setTopsFromGw(null);
    setTopsToGw(null);
    setTopsHorizon(null);
    setTopsError(null);
    setTopsLoading(false);
  }, [horizon]);

  useEffect(() => {
    if (!xiBenchMode) setXiFirst(null);
  }, [xiBenchMode]);

  function snapshotScenario(): PlannerScenarioSlot {
    return {
      picks: picks.map((p) => ({ ...p })),
      captainId,
      viceId,
      bank,
    };
  }

  function loadScenarioSlot(
    slot: PlannerScenarioSlot,
    opts?: { keepProjections?: boolean },
  ) {
    setPicks(slot.picks.map((p) => ({ ...p })));
    setBank(slot.bank);
    setCaptainId(slot.captainId);
    setViceId(slot.viceId);
    if (!opts?.keepProjections) {
      setProjById({});
      setProjMeta(null);
    }
    setSwapSlot(null);
    setSwapNotice(null);
    setXiBenchMode(false);
    setXiFirst(null);
  }

  function switchViewTab(next: PlannerViewTab) {
    setScenarioDraft((prev) => {
      let updated =
        viewTab !== "fpl"
          ? upsertScenarioSlot(prev, viewTab, snapshotScenario())
          : prev;
      if (next !== "fpl") {
        updated = { ...updated, activeScenario: next };
        loadScenarioSlot(resolveScenarioSlot(updated, next), {
          keepProjections: true,
        });
      }
      saveScenarioDraftLocal(updated);
      void saveScenarioDraftAccount(entryId, updated);
      return updated;
    });
    setViewTab(next);
  }

  function ensureActiveScenario() {
    if (viewTab === "fpl") {
      switchViewTab(scenarioDraft.activeScenario);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void hydrateScenarioDraftFromAccount(
      entryId,
      baselineKey,
      sortedInitial,
      initialBank,
      cap0,
      vice0,
    ).then((draft) => {
      if (cancelled) return;
      setScenarioDraft(draft);
      const active = draft.activeScenario;
      loadScenarioSlot(resolveScenarioSlot(draft, active));
      setViewTab(active);
      setDraftHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [entryId, baselineKey, sortedInitial, initialBank, cap0, vice0]);

  useEffect(() => {
    if (!draftHydrated || viewTab === "fpl") return;
    const timer = setTimeout(() => {
      setScenarioDraft((prev) => {
        const updated = upsertScenarioSlot(prev, viewTab, snapshotScenario());
        saveScenarioDraftLocal(updated);
        void saveScenarioDraftAccount(entryId, updated);
        return updated;
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [
    picks,
    bank,
    captainId,
    viceId,
    viewTab,
    draftHydrated,
    entryId,
  ]);

  useEffect(() => {
    if (swapSlot == null) {
      setSwapNotice(null);
      setSwapRecs([]);
      setSwapRecsLoading(false);
      return;
    }
    const out = picks.find((p) => p.slot === swapSlot);
    const position = out?.position;
    if (!position || !["GKP", "DEF", "MID", "FWD"].includes(position)) {
      setSwapRecs([]);
      return;
    }
    let cancelled = false;
    setSwapRecsLoading(true);
    setSwapRecs([]);
    const excludeIds = picks.map((p) => p.fpl_id);
    void fetch("/api/planner/swap-recs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        position,
        excludeIds,
        horizon,
      }),
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          recommendations?: import("@/lib/planner/swap-recommendations").SwapRecommendation[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "failed");
        if (!cancelled) setSwapRecs(data.recommendations ?? []);
      })
      .catch(() => {
        if (!cancelled) setSwapRecs([]);
      })
      .finally(() => {
        if (!cancelled) setSwapRecsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Only refetch when the slot (and thus outgoing position) changes — not on every pick edit mid-modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [swapSlot, horizon]);

  useEffect(() => {
    if (!inspectCtx) {
      setInspectDetail(null);
      setInspectErr(null);
      setInspectLoading(false);
      return;
    }
    let cancelled = false;
    setInspectLoading(true);
    setInspectErr(null);
    setInspectDetail(null);
    void fetch(
      `/api/planner/player-detail?fplId=${inspectCtx.fplId}&horizon=${horizon}`,
    )
      .then(async (res) => {
        const raw = await res.text();
        let data: (PlannerPlayerInspectDetail & { error?: string }) | null =
          null;
        try {
          data = JSON.parse(raw) as PlannerPlayerInspectDetail & {
            error?: string;
          };
        } catch {
          throw new Error(
            res.ok
              ? "Player detail returned an unexpected response."
              : `Could not load player detail (${res.status}).`,
          );
        }
        if (!res.ok) {
          throw new Error(
            data?.error ?? `Could not load player detail (${res.status}).`,
          );
        }
        if (!cancelled) setInspectDetail(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setInspectErr(
            e instanceof Error ? e.message : "Could not load player detail.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setInspectLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inspectCtx, horizon]);

  const issues = useMemo(
    () => validatePlannerSquad(picks),
    [picks],
  );
  const valid = issues.length === 0;

  const nextFxFetchKey = useMemo(() => {
    const u = Array.from(
      new Set([
        ...sortedInitial.map((p) => p.fpl_id),
        ...picks.map((p) => p.fpl_id),
      ]),
    ).sort((a, b) => a - b);
    return u.join(",");
  }, [sortedInitial, picks]);

  useEffect(() => {
    if (!valid || nextFxFetchKey === "") return;
    const ids = nextFxFetchKey.split(",").map(Number).filter((n) => n > 0);
    if (ids.length === 0) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/planner/next-fixtures", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ playerIds: ids }),
          signal: ac.signal,
        });
        const data = (await res.json()) as {
          nextByFplId?: Record<string, NextFixtureOpponent | null>;
          error?: string;
        };
        if (!res.ok) return;
        const rec: Record<number, NextFixtureOpponent | null> = {};
        for (const [k, v] of Object.entries(data.nextByFplId ?? {})) {
          rec[Number(k)] = v;
        }
        setNextFixtureByFplId(rec);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setNextFixtureByFplId({});
      }
    })();
    return () => ac.abort();
  }, [valid, nextFxFetchKey]);

  /** vs loaded FPL: different player and/or different XI vs bench role */
  const changedFromFpl = useMemo(() => {
    const s = new Set<number>();
    for (const p of picks) {
      const b = sortedInitial.find((x) => x.slot === p.slot);
      if (!b) continue;
      if (b.fpl_id !== p.fpl_id || b.is_starter !== p.is_starter) {
        s.add(p.slot);
      }
    }
    return s;
  }, [picks, sortedInitial]);

  const squadChanges = useMemo((): SquadChangeEntry[] => {
    const out: SquadChangeEntry[] = [];
    for (const p of picks) {
      const b = sortedInitial.find((x) => x.slot === p.slot);
      if (!b) continue;
      if (b.fpl_id !== p.fpl_id) {
        out.push({
          kind: "transfer",
          slot: p.slot,
          outName: b.web_name ?? `#${b.fpl_id}`,
          inName: p.web_name ?? `#${p.fpl_id}`,
        });
      } else if (b.is_starter !== p.is_starter) {
        out.push({
          kind: "lineup",
          slot: p.slot,
          name: p.web_name ?? `#${p.fpl_id}`,
          toStarter: p.is_starter,
        });
      }
    }
    return out.sort((a, b) => a.slot - b.slot);
  }, [picks, sortedInitial]);

  const isPlanPitch = viewTab !== "fpl";

  function fixCaptainViceAfterLineup(next: Row[]) {
    const xiIds = new Set(
      next.filter((p) => p.is_starter).map((p) => p.fpl_id),
    );
    const starters = [...next]
      .filter((p) => p.is_starter)
      .sort((a, b) => a.slot - b.slot);

    let newCap = captainId;
    if (newCap == null || !xiIds.has(newCap)) {
      newCap =
        starters.find((p) => p.position !== "GKP")?.fpl_id ??
        starters[0]?.fpl_id ??
        null;
    }

    let newVice = viceId;
    if (newVice == null || !xiIds.has(newVice) || newVice === newCap) {
      newVice =
        starters.find((p) => p.fpl_id !== newCap)?.fpl_id ?? null;
    }

    setCaptainId(newCap);
    setViceId(newVice);
  }

  function attemptXiBenchSwap(slotA: number, slotB: number) {
    const pa = picks.find((x) => x.slot === slotA);
    const pb = picks.find((x) => x.slot === slotB);
    if (!pa || !pb) return;
    if (pa.is_starter === pb.is_starter) {
      setProjError(t("errPickOneStarterBench"));
      return;
    }

    const next = picks.map((r) => {
      if (r.slot === slotA) return { ...r, is_starter: !r.is_starter };
      if (r.slot === slotB) return { ...r, is_starter: !r.is_starter };
      return r;
    });

    const starters = next.filter((r) => r.is_starter);
    const xiErr = validateXiFormation(starters);
    if (xiErr.length > 0) {
      setProjError(formatPlannerIssue(xiErr[0], t));
      return;
    }

    setPicks(next);
    fixCaptainViceAfterLineup(next);
    setProjError(null);
  }

  function handleBaselineInspect(slot: number) {
    const row = sortedInitial.find((x) => x.slot === slot);
    if (!row) return;
    setInspectCtx({
      side: "baseline",
      slot,
      fplId: row.fpl_id,
    });
  }

  function handlePlanningInteraction(slot: number) {
    if (xiBenchMode) {
      if (xiFirst == null) {
        setXiFirst(slot);
        setProjError(null);
        return;
      }
      if (xiFirst === slot) {
        setXiFirst(null);
        return;
      }
      attemptXiBenchSwap(xiFirst, slot);
      setXiFirst(null);
      return;
    }
    const row = picks.find((x) => x.slot === slot);
    if (!row) return;
    setInspectCtx({
      side: "scenario",
      slot,
      fplId: row.fpl_id,
    });
  }

  function inspectPlayerFromLeagueTops(fplId: number) {
    const inScenario = picks.find((p) => p.fpl_id === fplId);
    if (inScenario) {
      setInspectCtx({
        side: "scenario",
        slot: inScenario.slot,
        fplId,
      });
      return;
    }
    setInspectCtx({
      side: "baseline",
      slot: 1,
      fplId,
    });
  }

  function closeInspect() {
    setInspectCtx(null);
  }

  function transferFromInspect() {
    if (!inspectCtx || inspectCtx.side !== "scenario") return;
    const slot = inspectCtx.slot;
    closeInspect();
    openTransfer(slot);
  }

  function applyBestXiByProjection() {
    if (Object.keys(projById).length === 0) {
      setProjError(t("errRefreshXpFirst"));
      return;
    }
    const xpMap: Record<string, number> = {};
    for (const p of picks) {
      const pr = projById[String(p.fpl_id)];
      if (pr) xpMap[String(p.fpl_id)] = pr.xp_total;
    }
    const best = findBestXiByXp(picks, xpMap);
    if (!best || best.length !== 11) {
      setProjError(t("errNoValidXi"));
      return;
    }
    const setIds = new Set(best);
    const next = picks.map((p) => ({
      ...p,
      is_starter: setIds.has(p.fpl_id),
    }));
    setPicks(next);
    fixCaptainViceAfterLineup(next);
    setProjError(null);
  }

  function resetToFplTeam() {
    if (viewTab === "fpl") return;
    const reset = baselineScenarioSlot(
      sortedInitial,
      initialBank,
      cap0,
      vice0,
    );
    loadScenarioSlot(reset);
    setScenarioDraft((prev) => {
      const updated = upsertScenarioSlot(prev, viewTab, reset);
      saveScenarioDraftLocal(updated);
      void saveScenarioDraftAccount(entryId, updated);
      return updated;
    });
    setProjError(null);
  }

  const searchPlayers = useCallback(async (q: string) => {
    const t = q.trim();
    if (t.length < minPlayerQueryLength(t)) {
      setSearchHits([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: t, locale });
      const res = await fetch(`/api/planner/players?${params.toString()}`);
      const data = (await res.json()) as { players?: SearchPlayer[] };
      setSearchHits(data.players ?? []);
    } catch {
      setSearchHits([]);
    } finally {
      setSearching(false);
    }
  }, [locale]);

  function applySwap(slot: number, p: SearchPlayer) {
    if (p.fpl_id === picks.find((x) => x.slot === slot)?.fpl_id) {
      setSwapSlot(null);
      return;
    }
    const row = picks.find((x) => x.slot === slot);
    if (!row) return;
    const taken = new Set(picks.map((x) => x.fpl_id));
    if (taken.has(p.fpl_id) && p.fpl_id !== row.fpl_id) {
      setSwapNotice(t("errAlreadyInSquad"));
      return;
    }
    const newBank = swapBudget(bank, row.base_price, p.base_price);

    const next: Row = {
      ...row,
      fpl_id: p.fpl_id,
      web_name: p.web_name,
      team: p.team,
      team_id: p.team_id,
      position: p.position,
      base_price: p.base_price,
    };
    const draft = picks.map((r) => (r.slot === slot ? next : r));
    const vIssues = validatePlannerSquad(draft);
    if (vIssues.length > 0) {
      const first = vIssues[0];
      if (first.code === "club_cap" && p.team) {
        setSwapNotice(t("swapClubCap", { club: p.team }));
      } else {
        setSwapNotice(formatPlannerIssue(first, t));
      }
      return;
    }

    setPicks(draft);
    setBank(newBank);
    setProjError(null);
    // Mock transfers may go over budget — keep the swap and surface a shortfall notice.
    if (newBank < -0.05) {
      setSwapNotice(
        t("budgetShortfall", { short: Math.abs(newBank).toFixed(1) }),
      );
    } else {
      setSwapNotice(null);
    }
    if (captainId === row.fpl_id) setCaptainId(p.fpl_id);
    if (viceId === row.fpl_id) setViceId(p.fpl_id);
    setSwapSlot(null);
    setSearchQ("");
    setSearchHits([]);
  }

  function applySuggestion(s: TransferSuggestion) {
    ensureActiveScenario();
    const slot = picks.find((p) => p.fpl_id === s.out.fpl_id)?.slot;
    if (slot == null) {
      setSwapNotice(t("errSuggestOutMissing"));
      return;
    }
    const inbound: SearchPlayer = {
      fpl_id: s.in.fpl_id,
      web_name: s.in.web_name,
      name: s.in.web_name,
      team: s.in.team,
      team_id: s.in.team_id,
      position: s.in.position,
      base_price: s.in.price,
      status: "a",
      form: null,
      total_points: null,
      minutes: null,
      selected_by_percent: null,
      points_per_game: null,
      ict_index: null,
      goals_scored: null,
      assists: null,
      expected_goals: null,
      expected_assists: null,
    };
    applySwap(slot, inbound);
    requestAnimationFrame(() => {
      scenarioPitchRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function focusDiagnosedPlayer(fplId: number) {
    ensureActiveScenario();
    const row = picks.find((p) => p.fpl_id === fplId);
    if (!row) return;
    setInspectCtx({ side: "scenario", slot: row.slot, fplId });
    scenarioPitchRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function undoSlotChange(slot: number) {
    const baseline = sortedInitial.find((x) => x.slot === slot);
    if (!baseline) return;
    const current = picks.find((x) => x.slot === slot);
    if (!current) return;
    if (
      current.fpl_id === baseline.fpl_id &&
      current.is_starter === baseline.is_starter
    ) {
      return;
    }

    let newBank = bank;
    if (current.fpl_id !== baseline.fpl_id) {
      newBank = swapBudget(bank, current.base_price, baseline.base_price);
    }

    const draft = picks.map((p) =>
      p.slot === slot ? { ...baseline } : p,
    );
    setPicks(draft);
    setBank(newBank);
    fixCaptainViceAfterLineup(draft);
    setProjError(null);
  }

  const clearPendingApply = useCallback(() => {
    setPendingApplyState(null);
    const base = squadToggle?.useFreeHit
      ? `/planner/${entryId}?squad=freehit`
      : `/planner/${entryId}`;
    router.replace(base);
  }, [entryId, router, squadToggle?.useFreeHit]);

  async function runProject() {
    if (!valid) {
      setProjError(t("errFixSquadXp"));
      return;
    }
    setProjLoading(true);
    setProjError(null);
    try {
      let draftForIds = scenarioDraft;
      if (viewTab !== "fpl") {
        draftForIds = upsertScenarioSlot(
          scenarioDraft,
          viewTab,
          snapshotScenario(),
        );
      }
      const unionIds = projectionIdUnion(
        draftForIds,
        picks,
        sortedInitial,
      );
      const baselineIds = sortedInitial.map((p) => p.fpl_id);
      const chunks = chunkPlayerIdsForProject(unionIds, baselineIds);
      if (chunks.length === 0) {
        setProjError(t("errProjectionFailed"));
        return;
      }

      let merged: Record<string, ProjRow> = {};
      let fromGw: number | undefined;
      let toGw: number | undefined;
      let leagueTops: ProjectApiResponse["leagueTops"] = null;

      for (let i = 0; i < chunks.length; i++) {
        const res = await fetch("/api/planner/project", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            playerIds: chunks[i],
            horizon,
            includeLeagueTops: i === 0,
          }),
        });
        const data = await readJsonResponse<ProjectApiResponse>(res);
        if (!res.ok || !data) {
          setProjError(
            apiErrorMessage(res, data, t("errProjectionFailed")),
          );
          setTopsByPos(null);
          setTopsFromGw(null);
          setTopsToGw(null);
          setTopsHorizon(null);
          setTopsError(null);
          setTopsLoading(false);
          return;
        }
        merged = { ...merged, ...(data.projections ?? {}) };
        if (i === 0) {
          fromGw = data.fromGw;
          toGw = data.toGw;
          leagueTops = data.leagueTops ?? null;
        }
      }

      setProjById((prev) => ({ ...prev, ...merged }));
      setProjMeta(
        fromGw != null && toGw != null ? { fromGw, toGw } : null,
      );

      const lt = leagueTops;
      if (lt?.tops) {
        setTopsByPos(lt.tops);
        setTopsFromGw(lt.fromGw ?? fromGw ?? null);
        setTopsToGw(lt.toGw ?? toGw ?? null);
        setTopsHorizon(lt.horizon ?? horizon);
        setTopsError(null);
      } else {
        setTopsError(t("topsLoadFailed"));
        setTopsByPos(null);
        setTopsFromGw(null);
        setTopsToGw(null);
        setTopsHorizon(null);
      }
      setTopsLoading(false);
    } catch (e) {
      setProjError(e instanceof Error ? e.message : t("errProjectionFailed"));
      setTopsByPos(null);
      setTopsFromGw(null);
      setTopsToGw(null);
      setTopsHorizon(null);
      setTopsError(null);
      setTopsLoading(false);
    } finally {
      setProjLoading(false);
    }
  }

  // XI xP: starters only; captain row counted at ×2
  const xiXpDisplay = useMemo(() => {
    let sum = 0;
    for (const p of picks) {
      if (!p.is_starter) continue;
      const pr = projById[String(p.fpl_id)];
      if (!pr) continue;
      const mult = p.fpl_id === captainId ? 2 : 1;
      sum += pr.xp_total * mult;
    }
    return sum;
  }, [picks, projById, captainId]);

  const benchXp = useMemo(() => {
    let s = 0;
    for (const p of picks) {
      if (p.is_starter) continue;
      const pr = projById[String(p.fpl_id)];
      if (pr) s += pr.xp_total;
    }
    return s;
  }, [picks, projById]);

  /** Loaded FPL team (left pitch): XI / bench xP using same projections */
  const baselineXiXp = useMemo(() => {
    let sum = 0;
    for (const p of sortedInitial) {
      if (!p.is_starter) continue;
      const pr = projById[String(p.fpl_id)];
      if (!pr) continue;
      const mult = cap0 != null && p.fpl_id === cap0 ? 2 : 1;
      sum += pr.xp_total * mult;
    }
    return sum;
  }, [sortedInitial, projById, cap0]);

  const baselineBenchXp = useMemo(() => {
    let s = 0;
    for (const p of sortedInitial) {
      if (p.is_starter) continue;
      const pr = projById[String(p.fpl_id)];
      if (pr) s += pr.xp_total;
    }
    return s;
  }, [sortedInitial, projById]);

  const xiXpDelta = xiXpDisplay - baselineXiXp;

  const xptByScenario = useMemo(() => {
    const out: Record<ScenarioIndex, number | null> = {
      1: null,
      2: null,
      3: null,
    };
    if (!projMeta) return out;
    let draftForXpt = scenarioDraft;
    if (viewTab !== "fpl") {
      draftForXpt = upsertScenarioSlot(
        scenarioDraft,
        viewTab,
        snapshotScenario(),
      );
    }
    for (const i of scenarioIndexRange()) {
      out[i] = scenarioHorizonXpt(
        draftForXpt,
        i,
        projById,
        projMeta.fromGw,
        projMeta.toGw,
      );
    }
    return out;
  }, [
    scenarioDraft,
    viewTab,
    picks,
    bank,
    captainId,
    viceId,
    projById,
    projMeta,
  ]);

  const squadFplIds = useMemo(
    () => new Set(picks.map((p) => p.fpl_id)),
    [picks],
  );

  const panelXptsGw = projMeta?.fromGw ?? 1;

  const fetchPanelProjections = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return {};
      const res = await fetch("/api/squad-builder/projections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          playerIds: ids,
          fromGw: panelXptsGw,
          horizon: 1,
        }),
      });
      const data = await readJsonResponse<{
        projections?: Record<
          string,
          { by_gw?: { gw: number; xp: number }[]; xp_next_gw?: number }
        >;
        error?: string;
      }>(res);
      if (!res.ok || !data) {
        return {};
      }
      return data.projections ?? {};
    },
    [panelXptsGw],
  );

  const panelLabels = {
    title: tsb("panelTitle"),
    search: tsb("searchPlaceholder"),
    positionAll: tsb("filterPositionAll"),
    clubAll: tsb("filterClubAll"),
    priceAll: tsb("filterPriceAll"),
    sortPrice: tsb("sortByPrice"),
    sortPoints: tsb("sortPoints"),
    sortOwnership: tsb("sortOwnership"),
    sortForm: tsb("sortForm"),
    sortXpts: tsb("sortXpts"),
    colName: tsb("colName"),
    colOwn: tsb("colOwn"),
    colPrice: tsb("colPrice"),
    colLastSeason: tsb("colLastSeason"),
    colXpts: tsb("colXpts"),
    inSquad: tsb("inSquad"),
    loading: tsb("panelLoading"),
    empty: tsb("panelEmpty"),
    updatedAt: tsb("panelUpdated"),
  };

  function addPlayerFromPanel(player: BrowsePlayer) {
    if (swapSlot == null) {
      setSwapNotice(t("panelPickSlotFirst"));
      return;
    }
    applySwap(swapSlot, browseToSearchPlayer(player));
  }

  function openTransfer(slot: number) {
    setSwapSlot(slot);
    setSearchQ("");
    setSearchHits([]);
    setProjError(null);
    setSwapNotice(null);
  }

  const baselinePitchSubline = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of sortedInitial) {
      m[p.fpl_id] = pitchSecondLineFromNext(p, nextFixtureByFplId);
    }
    return m;
  }, [sortedInitial, nextFixtureByFplId]);

  const attentionByFplId = useMemo((): Record<number, SquadPlayerSignal> | undefined => {
    const raw = diagnoseData?.signals_by_fpl_id;
    if (!raw) return undefined;
    const out: Record<number, SquadPlayerSignal> = {};
    for (const [k, v] of Object.entries(raw)) {
      out[Number(k)] = v;
    }
    return out;
  }, [diagnoseData?.signals_by_fpl_id]);

  const scenarioPitchSubline = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of picks) {
      m[p.fpl_id] = pitchSecondLineFromNext(p, nextFixtureByFplId);
    }
    return m;
  }, [picks, nextFixtureByFplId]);

  /** Next GW (first GW in projection window) xP per card; captain starter ×2 */
  const baselineNextGwXpByFplId = useMemo(() => {
    if (!projMeta) return undefined;
    const out: Record<number, number> = {};
    for (const row of sortedInitial) {
      const pr = projById[String(row.fpl_id)];
      const base = pr?.xp_next_gw;
      if (base == null || !Number.isFinite(base)) continue;
      const mult =
        row.is_starter && cap0 != null && row.fpl_id === cap0 ? 2 : 1;
      out[row.fpl_id] = Math.round(base * mult * 10) / 10;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }, [sortedInitial, projById, projMeta, cap0]);

  const scenarioNextGwXpByFplId = useMemo(() => {
    if (!projMeta) return undefined;
    const out: Record<number, number> = {};
    for (const row of picks) {
      const pr = projById[String(row.fpl_id)];
      const base = pr?.xp_next_gw;
      if (base == null || !Number.isFinite(base)) continue;
      const mult =
        row.is_starter &&
        captainId != null &&
        row.fpl_id === captainId
          ? 2
          : 1;
      out[row.fpl_id] = Math.round(base * mult * 10) / 10;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }, [picks, projById, projMeta, captainId]);

  const pitchCardXpTitle = t("pitchCardNextGwXpTitle", {
    gw: projMeta?.fromGw ?? "–",
  });

  /** Up to 5 GWs: opponent code + H/A and xP per GW (after Refresh xP). */
  const gwForecastByFplId = useMemo(() => {
    if (Object.keys(projById).length === 0) return undefined;
    const out: Record<number, PlannerGwStripCell[]> = {};
    for (const id of Object.keys(projById)) {
      const pr = projById[id];
      const strip = pr?.by_gw;
      if (!strip?.length) continue;
      out[Number(id)] = strip.slice(0, 5);
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }, [projById]);

  const scenarioPitchRef = useRef<HTMLDivElement>(null);
  const [pngBusy, setPngBusy] = useState(false);
  const [pngError, setPngError] = useState<string | null>(null);

  const downloadScenarioPng = useCallback(async () => {
    const el = scenarioPitchRef.current;
    if (!el) return;
    setPngBusy(true);
    setPngError(null);
    let restoreImages: (() => void) | null = null;
    try {
      restoreImages = await preparePitchForPngExport(el);

      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(el, {
        pixelRatio: pitchExportPixelRatio(),
        cacheBust: false,
        backgroundColor: "#052e16",
        skipFonts: true,
        includeQueryParams: true,
        filter: (node) =>
          !(
            node instanceof HTMLElement && node.hasAttribute("data-png-skip")
          ),
        onImageErrorHandler: () => undefined,
      });
      if (!blob) {
        throw new Error("empty png blob");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fpl-planner-${entryId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[planner] download pitch png", err);
      setPngError(t("downloadScenarioPngFailed"));
    } finally {
      restoreImages?.();
      setPngBusy(false);
    }
  }, [entryId, t]);

  return (
    <div className="flex flex-col gap-5 sm:gap-6 md:gap-8">
      {baselineBanner ? (
        <div
          className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100/90 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
          role="status"
        >
          <p>{baselineBanner}</p>
          {squadToggle ? (
            <p className="mt-2 flex flex-wrap gap-2 text-[11px] text-amber-200/80 sm:gap-4 sm:text-xs">
              {squadToggle.useFreeHit ? (
                <Link
                  href={squadToggle.pathBase}
                  className="font-medium text-amber-200 underline decoration-amber-500/50 underline-offset-2 transition-colors hover:text-foreground"
                >
                  {t("planWithRevert")}
                </Link>
              ) : (
                <Link
                  href={`${squadToggle.pathBase}?squad=freehit`}
                  className="font-medium text-amber-200 underline decoration-amber-500/50 underline-offset-2 transition-colors hover:text-foreground"
                >
                  {t("viewTempFh")}
                </Link>
              )}
            </p>
          ) : null}
        </div>
      ) : null}
      <section className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5 sm:gap-6 sm:pb-8">
        <div className="max-w-2xl">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-brand-accent sm:mb-2 sm:text-xs">
            {t("eyebrow")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:mt-3 sm:text-sm">
            <span className="text-foreground/70">{entryName}</span>
            {" · "}
            {t("subtitleSuffix")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={
              squadToggle?.useFreeHit
                ? `/planner/${entryId}?refresh=1&squad=freehit`
                : `/planner/${entryId}?refresh=1`
            }
            title={t("refreshSquadTitle")}
            className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/15"
          >
            {t("refreshSquad")}
          </Link>
          <Link
            href={`/dashboard/${entryId}`}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground/70 transition-colors hover:border-brand-accent/30 hover:text-foreground"
          >
            {t("dashboard")}
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        <div className="grid grid-cols-2 gap-2 sm:contents sm:flex sm:flex-wrap sm:gap-4">
          <div className="min-w-0">
            <label className="mb-1 block text-[10px] uppercase text-muted-foreground">
              {t("bank")}
            </label>
            <div
              className={cn(
                "rounded-lg border px-2 py-1.5 text-base font-semibold tabular-nums sm:px-3 sm:py-2 sm:text-lg",
                bank < -0.05
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  : "border-border bg-muted text-foreground",
              )}
            >
              £{bank.toFixed(1)}m
            </div>
            {bank < -0.05 ? (
              <p className="mt-1 text-[11px] leading-snug text-amber-300/90">
                {t("budgetShortfall", { short: Math.abs(bank).toFixed(1) })}
              </p>
            ) : null}
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[10px] uppercase text-muted-foreground">
              {t("horizon")}
            </label>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label={t("horizon")}
              value={horizonDraft}
              onChange={(e) => {
                const next = e.target.value;
                if (next !== "" && !/^\d+$/.test(next)) return;
                setHorizonDraft(next);
                if (next === "") return;
                const n = parseInt(next, 10);
                if (!Number.isNaN(n)) {
                  setHorizon(Math.min(8, Math.max(1, n)));
                }
              }}
              onBlur={() => {
                const raw = horizonDraft.trim();
                if (raw === "") {
                  setHorizonDraft(String(horizon));
                  return;
                }
                const n = parseInt(raw, 10);
                if (Number.isNaN(n)) {
                  setHorizonDraft(String(horizon));
                  return;
                }
                const clamped = Math.min(8, Math.max(1, n));
                setHorizon(clamped);
                setHorizonDraft(String(clamped));
              }}
              className="h-9 w-full min-w-0 max-w-[5.5rem] px-2 text-center text-sm tabular-nums sm:h-10 sm:w-20 sm:max-w-none sm:px-3"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-[10px] uppercase text-muted-foreground">
              {t("captain")}
            </label>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60 sm:h-auto sm:py-2 sm:text-sm"
              disabled={!isPlanPitch}
              value={(isPlanPitch ? captainId : cap0) ?? ""}
              onChange={(e) => {
                setProjError(null);
                setCaptainId(Number(e.target.value) || null);
              }}
            >
              {(isPlanPitch ? picks : sortedInitial)
                .filter((p) => p.is_starter)
                .map((p) => (
                  <option key={p.fpl_id} value={p.fpl_id}>
                    {p.web_name ?? p.fpl_id} ({p.position})
                  </option>
                ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-[10px] uppercase text-muted-foreground">
              {t("vice")}
            </label>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60 sm:h-auto sm:py-2 sm:text-sm"
              disabled={!isPlanPitch}
              value={(isPlanPitch ? viceId : vice0) ?? ""}
              onChange={(e) => {
                setProjError(null);
                setViceId(Number(e.target.value) || null);
              }}
            >
              <option value="">—</option>
              {(isPlanPitch ? picks : sortedInitial)
                .filter((p) => {
                  const cap = isPlanPitch ? captainId : cap0;
                  return p.is_starter && p.fpl_id !== cap;
                })
                .map((p) => (
                  <option key={p.fpl_id} value={p.fpl_id}>
                    {p.web_name ?? p.fpl_id}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={runProject}
            disabled={projLoading || !valid}
            className="flex-1 text-xs sm:flex-none sm:text-sm"
          >
            {projLoading ? t("refreshXpLoading") : t("refreshXp")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={applyBestXiByProjection}
            disabled={!valid || Object.keys(projById).length === 0}
            title={t("bestXiTitle")}
            className="flex-1 text-xs sm:flex-none sm:text-sm"
          >
            {t("bestXiByXp")}
          </Button>
          <Button
            type="button"
            variant={xiBenchMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => setXiBenchMode((v) => !v)}
            title={t("xiBenchTitle")}
            className="min-w-[42%] flex-1 text-xs sm:min-w-0 sm:flex-none sm:text-sm"
          >
            {xiBenchMode ? t("xiBenchOn") : t("xiBenchOff")}
          </Button>
        </div>
      </section>

      {issues.length > 0 && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 sm:px-4 sm:py-3 sm:text-sm">
          <ul className="list-disc pl-5">
            {issues.map((i) => (
              <li key={i.code}>{formatPlannerIssue(i, t)}</li>
            ))}
          </ul>
        </div>
      )}

      {projError && (
        <p className="text-sm text-rose-300">{projError}</p>
      )}

      <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_min(22rem,100%)]">
        <div className="min-w-0 flex flex-col gap-5 sm:gap-6">
          <section className="flex flex-col gap-2 sm:gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl space-y-1 text-xs text-muted-foreground">
            <p>
              {t("hintPitchLead")}{" "}
              <strong>{t("hintBoldXi")}</strong>
              {t("hintPitchXiSuffix")}{" "}
              <strong>{t("hintBoldTransfer")}</strong>
              {t("hintPitchClose")}
            </p>
            <p className="text-[11px] text-muted-foreground/80">{t("hintTapProfile")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PlannerScenarioTabs
              viewTab={viewTab}
              xptByScenario={xptByScenario}
              onSelect={switchViewTab}
              fplLabel={t("pitchModeFpl")}
              planLabel={(index) =>
                t("scenarioPlanLabel", {
                  letter: String.fromCharCode(64 + index),
                })
              }
              scenariosLabel={t("scenariosLabel")}
            />
            <Link
              href={`/dashboard/${entryId}`}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground/70 no-underline transition-colors hover:border-brand-accent/30 hover:text-foreground sm:px-3"
            >
              {t("openOnDashboard")}
            </Link>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!isPlanPitch || squadChanges.length === 0}
              onClick={resetToFplTeam}
            >
              {t("resetScenario")}
            </Button>
          </div>
        </div>

        {isPlanPitch && squadChanges.length > 0 ? (
          <PlannerChangesStrip
            changes={squadChanges}
            bank={bank}
            xiDelta={xiXpDelta}
            showXiDelta={projMeta != null && Object.keys(projById).length > 0}
            onUndo={undoSlotChange}
          />
        ) : null}

        <PitchView
          ref={scenarioPitchRef}
          title={
            isPlanPitch
              ? t("planningScenarioNamed", {
                  letter: String.fromCharCode(64 + viewTab),
                })
              : t("pitchYourFpl")
          }
          benchLabel={t("pitchBench")}
          benchGkAbbrev={t("pitchBenchGkAbbrev")}
          titleAction={
            isPlanPitch ? (
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 text-[10px] sm:h-8 sm:px-2.5 sm:text-xs"
                  disabled={pngBusy}
                  onClick={() => void downloadScenarioPng()}
                >
                  {pngBusy
                    ? t("downloadScenarioPngWorking")
                    : t("downloadScenarioPng")}
                </Button>
                {pngError ? (
                  <p className="max-w-[11rem] text-right text-[10px] leading-snug text-red-400">
                    {pngError}
                  </p>
                ) : null}
              </div>
            ) : null
          }
          caption={
            isPlanPitch
              ? bank < -0.05
                ? t("pitchPlanningCaptionShortfall", {
                    short: Math.abs(bank).toFixed(1),
                    n: changedFromFpl.size,
                  })
                : changedFromFpl.size > 0
                  ? t("pitchPlanningCaptionDiff", {
                      n: changedFromFpl.size,
                      bank: bank.toFixed(1),
                    })
                  : t("pitchPlanningCaptionSame", { bank: bank.toFixed(1) })
              : t("pitchModeFplHint")
          }
          picks={isPlanPitch ? picks : sortedInitial}
          captainId={isPlanPitch ? captainId : cap0}
          viceId={isPlanPitch ? viceId : vice0}
          cardSublineByFplId={
            isPlanPitch ? scenarioPitchSubline : baselinePitchSubline
          }
          gwForecastByFplId={gwForecastByFplId}
          nextGwXpByFplId={
            isPlanPitch ? scenarioNextGwXpByFplId : baselineNextGwXpByFplId
          }
          nextGwXpTitle={pitchCardXpTitle}
          attentionByFplId={attentionByFplId}
          showAttentionLegend
          highlightSlots={isPlanPitch ? changedFromFpl : undefined}
          reorderSelectedSlot={
            isPlanPitch && xiBenchMode ? xiFirst : null
          }
          interactive
          onPickSlot={
            isPlanPitch ? handlePlanningInteraction : handleBaselineInspect
          }
          appearance="showcase"
          gkAtTop
        />
      </section>

      <PlannerDiagnosePanel
        entryId={entryId}
        horizon={horizon}
        viewingFreeHitSquad={Boolean(squadToggle?.useFreeHit)}
        defaultExpanded={initialSuggestOpen}
        onFocusPlayer={focusDiagnosedPlayer}
        onApplySuggestion={applySuggestion}
        pendingApply={pendingApplyState}
        onPendingApplyConsumed={clearPendingApply}
        onDataLoaded={setDiagnoseData}
      />

      {projMeta && Object.keys(projById).length > 0 && (
        <div className="rounded-xl border border-border bg-card px-3 py-3 text-sm sm:px-4 sm:py-4">
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-muted-foreground">
              {t("gwRange", {
                from: projMeta.fromGw,
                to: projMeta.toGw,
              })}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-input px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("fplThisPage")}
              </p>
              <p className="mt-1 text-muted-foreground">
                {t("xiXpLine", {
                  value: baselineXiXp.toFixed(1),
                })}
              </p>
              <p className="text-muted-foreground">
                {t("benchLine", {
                  value: baselineBenchXp.toFixed(1),
                })}
              </p>
            </div>
            <div className="rounded-lg border border-brand-accent/25 bg-brand-accent/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-brand-accent">
                {t("planningScenario")}
              </p>
              <p className="mt-1 text-foreground/70">
                {t("xiXpLine", {
                  value: xiXpDisplay.toFixed(1),
                })}
              </p>
              <p className="text-muted-foreground">
                {t("benchLine", {
                  value: benchXp.toFixed(1),
                })}
              </p>
              <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                {t("deltaXiLabel")}
                <span
                  className={
                    xiXpDelta >= 0
                      ? "font-semibold text-emerald-400"
                      : "font-semibold text-rose-300"
                  }
                >
                  {xiXpDelta >= 0 ? "+" : ""}
                  {xiXpDelta.toFixed(1)}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="scroll-table scroll-table--bordered bg-muted sm:rounded-xl">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-1.5 sm:px-3 sm:py-2">{t("tableSlot")}</th>
              <th className="px-1.5 py-1.5 sm:px-2 sm:py-2">{t("tablePlayer")}</th>
              <th className="px-1.5 py-1.5 sm:px-2 sm:py-2">{t("tablePos")}</th>
              <th className="px-1.5 py-1.5 sm:px-2 sm:py-2">{t("tableClub")}</th>
              <th className="px-1.5 py-1.5 sm:px-2 sm:py-2">{t("tablePrice")}</th>
              <th className="px-1.5 py-1.5 text-right sm:px-2 sm:py-2">{t("tableXpHorizon")}</th>
              <th className="px-1.5 py-1.5 text-right sm:px-2 sm:py-2">{t("tableAction")}</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => {
              const pr = projById[String(p.fpl_id)];
              const cap =
                p.fpl_id === captainId ? (
                  <span className="ml-1 text-brand-accent text-[10px]">
                    {t("tableBadgeCaptain")}
                  </span>
                ) : p.fpl_id === viceId ? (
                  <span className="ml-1 text-muted-foreground text-[10px]">
                    {t("tableBadgeVice")}
                  </span>
                ) : null;
              return (
                <tr
                  key={p.slot}
                  className={cn(
                    "border-t border-border/60",
                    p.is_starter ? "" : "opacity-80",
                    xiBenchMode && xiFirst === p.slot && "bg-sky-500/10",
                  )}
                >
                  <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                    {p.slot}
                    {!p.is_starter && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {t("benchTag")}
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 font-medium sm:px-2 sm:py-2">
                    {p.web_name ?? `#${p.fpl_id}`}
                    {cap}
                  </td>
                  <td className="px-1.5 py-1.5 text-muted-foreground sm:px-2 sm:py-2">{p.position}</td>
                  <td className="px-1.5 py-1.5 text-foreground/70 sm:px-2 sm:py-2">{p.team}</td>
                  <td className="px-1.5 py-1.5 sm:px-2 sm:py-2">
                    {p.base_price != null ? p.base_price.toFixed(1) : "–"}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-medium sm:px-2 sm:py-2">
                    {pr ? (
                      <>
                        {pr.xp_total.toFixed(1)}
                        {p.fpl_id === captainId && (
                          <span className="text-muted-foreground text-xs">
                            {" "}
                            {t("captainTag", {
                              value: (pr.xp_total * 2).toFixed(1),
                            })}
                          </span>
                        )}
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 text-right sm:px-2 sm:py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      {isPlanPitch && !xiBenchMode ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openTransfer(p.slot)}
                        >
                          {t("btnTransfer")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant={xiBenchMode ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => handlePlanningInteraction(p.slot)}
                      >
                        {xiBenchMode
                          ? xiFirst === p.slot
                            ? t("btnClear")
                            : xiFirst != null
                              ? t("btnSwap")
                              : t("btnPick")
                          : t("btnInspect")}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
        </div>

        {isPlanPitch && teams.length > 0 ? (
          <div className="hidden min-w-0 lg:block">
            <SquadBuilderPlayerPanel
              selectedSlot={swapSlot}
              slotPosition={
                swapSlot != null ? slotPosition(swapSlot) : null
              }
              bank={bank}
              xptsGw={panelXptsGw}
              projById={projById}
              squadFplIds={squadFplIds}
              teams={teams}
              onPickPlayer={addPlayerFromPanel}
              onInspectPlayer={(fplId) => {
                const inScenario = picks.find((p) => p.fpl_id === fplId);
                if (inScenario) {
                  setInspectCtx({
                    side: "scenario",
                    slot: inScenario.slot,
                    fplId,
                  });
                } else {
                  setInspectCtx({
                    side: "baseline",
                    slot: 1,
                    fplId,
                  });
                }
              }}
              fetchProjections={fetchPanelProjections}
              labels={panelLabels}
            />
            {swapNotice ? (
              <p
                role="alert"
                className="mt-2 text-xs text-amber-200/90"
              >
                {swapNotice}
              </p>
            ) : null}
          </div>
        ) : null}
        </div>

        <PlannerTopXpSidebar
          loading={topsLoading}
          error={topsError}
          tops={topsByPos}
          fromGw={topsFromGw}
          toGw={topsToGw}
          horizon={topsHorizon}
          onInspectPlayer={inspectPlayerFromLeagueTops}
        />
      </div>

      {swapSlot != null && !isLg && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-2xl shadow-black/50 sm:rounded-2xl sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold">
                {(() => {
                  const name = picks.find((p) => p.slot === swapSlot)?.web_name;
                  return name
                    ? t("replacePlayer", { name })
                    : t("replaceSlot", { slot: swapSlot });
                })()}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setSwapSlot(null)}>
                {t("close")}
              </Button>
            </div>
            {(() => {
              const out = picks.find((p) => p.slot === swapSlot);
              if (!out) return null;
              const outPrice = out.base_price ?? 0;
              return (
                <div className="mb-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("transferOut")}
                  </p>
                  <p className="mt-0.5 font-medium text-foreground">
                    {out.web_name}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {out.team} · {out.position} · £{outPrice.toFixed(1)}m
                    </span>
                  </p>
                  <p
                    className={cn(
                      "mt-1.5 text-xs tabular-nums",
                      bank < -0.05 ? "text-amber-300" : "text-muted-foreground",
                    )}
                  >
                    {t("swapBankLeft", { bank: bank.toFixed(1) })}
                  </p>
                </div>
              );
            })()}
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQ}
              onChange={(e) => {
                const v = e.target.value;
                setSearchQ(v);
                setSwapNotice(null);
                void searchPlayers(v);
              }}
              autoFocus
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t("searchHint")}
            </p>

            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("swapRecsTitle")}
              </p>
              {swapRecsLoading ? (
                <p className="text-xs text-muted-foreground">{t("swapRecsLoading")}</p>
              ) : swapRecs.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("swapRecsEmpty")}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {swapRecs.map((rec) => {
                    const bankAfter = swapBudget(
                      bank,
                      picks.find((p) => p.slot === swapSlot)?.base_price ?? 0,
                      rec.base_price,
                    );
                    const over = bankAfter < -0.05;
                    const kindLabel =
                      rec.kind === "xp"
                        ? t("swapRecKindXp")
                        : rec.kind === "dc"
                          ? t("swapRecKindDc")
                          : t("swapRecKindThreat");
                    const fx = rec.next
                      ? `${rec.next.opp_short} (${rec.next.home ? "H" : "A"})${
                          rec.next.fdr != null ? ` · FDR ${rec.next.fdr}` : ""
                        }`
                      : "—";
                    return (
                      <li key={`${rec.kind}-${rec.fpl_id}`}>
                        <button
                          type="button"
                          className="w-full rounded-lg border border-brand-accent/25 bg-brand-accent/5 px-3 py-2 text-left text-sm transition-colors hover:border-brand-accent/45 hover:bg-brand-accent/10"
                          onClick={() =>
                            applySwap(swapSlot, {
                              fpl_id: rec.fpl_id,
                              web_name: rec.web_name,
                              name: rec.web_name,
                              team: rec.team,
                              team_id: rec.team_id,
                              position: rec.position,
                              base_price: rec.base_price,
                              status: "a",
                              form: null,
                              total_points: null,
                              minutes: null,
                              selected_by_percent: null,
                              points_per_game: null,
                              ict_index: null,
                              goals_scored: null,
                              assists: null,
                              expected_goals: null,
                              expected_assists: null,
                            })
                          }
                        >
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="rounded bg-brand-accent/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brand-accent">
                              {kindLabel}
                            </span>
                            <span className="font-medium text-foreground">
                              {rec.web_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {rec.team} · £{rec.base_price?.toFixed(1) ?? "?"}m
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {rec.metric_label} {rec.metric_value} · {fx}
                            {" · "}
                            <span
                              className={
                                over ? "text-amber-300" : "text-brand-accent/90"
                              }
                            >
                              {t("swapBankAfter", {
                                bank: bankAfter.toFixed(1),
                              })}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {swapNotice ? (
              <div
                role="alert"
                aria-live="polite"
                className="mt-3 rounded-lg border border-rose-500/45 bg-rose-500/10 px-3 py-2.5 text-sm leading-snug text-rose-100/95"
              >
                {swapNotice}
              </div>
            ) : null}
            <ul className="mt-3 flex flex-col gap-1">
              {searching && (
                <li className="text-sm text-muted-foreground">{t("searching")}</li>
              )}
              {!searching &&
                searchHits.map((h) => {
                  const out = picks.find((p) => p.slot === swapSlot);
                  const bankAfter = swapBudget(
                    bank,
                    out?.base_price ?? 0,
                    h.base_price,
                  );
                  const over = bankAfter < -0.05;
                  return (
                  <li key={h.fpl_id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-border/60 bg-muted px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => applySwap(swapSlot, h)}
                    >
                      <span className="font-medium">{h.web_name ?? h.name}</span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {h.team} · {h.position} · £{h.base_price?.toFixed(1) ?? "?"}m
                        {h.total_points != null && (
                          <> · {h.total_points} pts</>
                        )}
                        {h.form != null && (
                          <> · form {Number(h.form).toFixed(1)}</>
                        )}
                        {h.selected_by_percent != null && (
                          <>
                            {" "}
                            · {Number(h.selected_by_percent).toFixed(0)}% own
                          </>
                        )}
                        {h.ict_index != null && (
                          <> · ICT {Number(h.ict_index).toFixed(1)}</>
                        )}
                        {h.status && h.status !== "a" && (
                          <span className="text-amber-300"> · {h.status}</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-[11px] tabular-nums",
                          over ? "text-amber-300" : "text-brand-accent/90",
                        )}
                      >
                        {t("swapBankAfter", { bank: bankAfter.toFixed(1) })}
                        {over
                          ? ` · ${t("swapShortBy", { short: Math.abs(bankAfter).toFixed(1) })}`
                          : ""}
                      </span>
                    </button>
                  </li>
                  );
                })}
            </ul>
          </div>
        </div>
      )}

      <PlannerPlayerInspectSheet
        open={inspectCtx != null}
        loading={inspectLoading}
        error={inspectErr}
        detail={inspectDetail}
        showTransfer={inspectCtx?.side === "scenario"}
        onClose={closeInspect}
        onTransfer={transferFromInspect}
      />
    </div>
  );
}
