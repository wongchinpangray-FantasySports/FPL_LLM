"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { NextFixtureOpponent } from "@/lib/xp";
import { findBestXiByXp } from "@/lib/planner/optimize-xi";
import type { ValidationIssue } from "@/lib/planner/validate";
import type {
  PlannerTopPosition,
  TopXpPlayerRow,
} from "@/lib/planner/top-xp-by-position";
import { PlannerTopXpSidebar } from "@/components/planner/planner-top-xp-sidebar";
import {
  canAfford,
  swapBudget,
  validatePlannerSquad,
  validateXiFormation,
} from "@/lib/planner/validate";

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
import { PitchView } from "@/components/planner/pitch-view";
import type { PlannerPickPayload } from "@/components/planner/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  baselineBanner = null,
  squadToggle = null,
}: {
  entryId: number;
  entryName: string;
  initialBank: number;
  initialPicks: PlannerPickPayload[];
  /** Shown when Free Hit active: explains revert vs temp 15 */
  baselineBanner?: string | null;
  /** Links to switch ?squad=freehit vs default */
  squadToggle?: {
    useFreeHit: boolean;
    pathBase: string;
  } | null;
}) {
  const t = useTranslations("plannerApp");

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

  const [swapSlot, setSwapSlot] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchPlayer[]>([]);
  const [searching, setSearching] = useState(false);

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
        const data = (await res.json()) as PlannerPlayerInspectDetail & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        if (!cancelled) setInspectDetail(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setInspectErr(e instanceof Error ? e.message : "Request failed");
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

  function closeInspect() {
    setInspectCtx(null);
  }

  function transferFromInspect() {
    if (!inspectCtx || inspectCtx.side !== "scenario") return;
    const slot = inspectCtx.slot;
    closeInspect();
    setSwapSlot(slot);
    setSearchQ("");
    setSearchHits([]);
    setProjError(null);
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
    setPicks(sortedInitial.map((p) => ({ ...p })));
    setBank(initialBank);
    setCaptainId(cap0);
    setViceId(vice0);
    setProjById({});
    setProjMeta(null);
    setProjError(null);
    setXiBenchMode(false);
    setXiFirst(null);
  }

  const searchPlayers = useCallback(async (q: string) => {
    const t = q.trim();
    if (t.length < 2) {
      setSearchHits([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/planner/players?q=${encodeURIComponent(t)}`,
      );
      const data = (await res.json()) as { players?: SearchPlayer[] };
      setSearchHits(data.players ?? []);
    } catch {
      setSearchHits([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function applySwap(slot: number, p: SearchPlayer) {
    if (p.fpl_id === picks.find((x) => x.slot === slot)?.fpl_id) {
      setSwapSlot(null);
      return;
    }
    const row = picks.find((x) => x.slot === slot);
    if (!row) return;
    const taken = new Set(picks.map((x) => x.fpl_id));
    if (taken.has(p.fpl_id) && p.fpl_id !== row.fpl_id) {
      setProjError(t("errAlreadyInSquad"));
      return;
    }
    const newBank = swapBudget(bank, row.base_price, p.base_price);
    if (!canAfford(newBank)) {
      const need = (
        (row.base_price ?? 0) -
        (p.base_price ?? 0) +
        bank
      ).toFixed(1);
      setProjError(
        t("errBudget", { need, bank: bank.toFixed(1) }),
      );
      return;
    }

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
      setProjError(formatPlannerIssue(vIssues[0], t));
      return;
    }

    setPicks(draft);
    setBank(newBank);
    setProjError(null);
    if (captainId === row.fpl_id) setCaptainId(p.fpl_id);
    if (viceId === row.fpl_id) setViceId(p.fpl_id);
    setSwapSlot(null);
    setSearchQ("");
    setSearchHits([]);
    setProjById({});
    setProjMeta(null);
  }

  async function runProject() {
    if (!valid) {
      setProjError(t("errFixSquadXp"));
      return;
    }
    setProjLoading(true);
    setProjError(null);
    try {
      const scenarioIds = [...picks].map((p) => p.fpl_id);
      const baselineIds = sortedInitial.map((p) => p.fpl_id);
      const unionIds = Array.from(new Set([...scenarioIds, ...baselineIds]));

      const res = await fetch("/api/planner/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerIds: unionIds,
          horizon,
        }),
      });
      const data = (await res.json()) as {
        projections?: Record<string, ProjRow>;
        fromGw?: number;
        toGw?: number;
        error?: string;
      };
      if (!res.ok) {
        setProjError(data.error ?? t("errProjectionFailed"));
        setTopsByPos(null);
        setTopsFromGw(null);
        setTopsToGw(null);
        setTopsHorizon(null);
        setTopsError(null);
        setTopsLoading(false);
        return;
      }
      setProjById(data.projections ?? {});
      setProjMeta(
        data.fromGw != null && data.toGw != null
          ? { fromGw: data.fromGw, toGw: data.toGw }
          : null,
      );

      setTopsLoading(true);
      setTopsError(null);
      try {
        const topRes = await fetch("/api/planner/top-xp-by-position", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ horizon }),
        });
        const topData = (await topRes.json()) as {
          tops?: Record<PlannerTopPosition, TopXpPlayerRow[]>;
          fromGw?: number;
          toGw?: number;
          horizon?: number;
          error?: string;
        };
        if (!topRes.ok) {
          setTopsError(topData.error ?? t("topsLoadFailed"));
          setTopsByPos(null);
          setTopsFromGw(null);
          setTopsToGw(null);
          setTopsHorizon(null);
        } else {
          setTopsByPos(topData.tops ?? null);
          setTopsFromGw(topData.fromGw ?? null);
          setTopsToGw(topData.toGw ?? null);
          setTopsHorizon(topData.horizon ?? null);
        }
      } catch {
        setTopsError(t("topsLoadFailed"));
        setTopsByPos(null);
        setTopsFromGw(null);
        setTopsToGw(null);
        setTopsHorizon(null);
      } finally {
        setTopsLoading(false);
      }
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

  const baselinePitchSubline = useMemo(() => {
    const m: Record<number, string> = {};
    for (const p of sortedInitial) {
      m[p.fpl_id] = pitchSecondLineFromNext(p, nextFixtureByFplId);
    }
    return m;
  }, [sortedInitial, nextFixtureByFplId]);

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
                  className="font-medium text-amber-200 underline decoration-amber-500/50 underline-offset-2 transition-colors hover:text-white"
                >
                  {t("planWithRevert")}
                </Link>
              ) : (
                <Link
                  href={`${squadToggle.pathBase}?squad=freehit`}
                  className="font-medium text-amber-200 underline decoration-amber-500/50 underline-offset-2 transition-colors hover:text-white"
                >
                  {t("viewTempFh")}
                </Link>
              )}
            </p>
          ) : null}
        </div>
      ) : null}
      <section className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-5 sm:gap-6 sm:pb-8">
        <div className="max-w-2xl">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-brand-accent sm:mb-2 sm:text-xs">
            {t("eyebrow")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400 sm:mt-3 sm:text-sm">
            <span className="text-slate-300">{entryName}</span>
            {" · "}
            {t("subtitleSuffix")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/${entryId}`}
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition-colors hover:border-brand-accent/30 hover:text-white"
          >
            {t("dashboard")}
          </Link>
          <Link
            href="/chat"
            className="rounded-lg border border-brand-accent/25 bg-brand-accent/10 px-3 py-2 text-sm font-medium text-brand-accent transition-colors hover:bg-brand-accent/15"
          >
            {t("chat")}
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        <div className="grid grid-cols-2 gap-2 sm:contents sm:flex sm:flex-wrap sm:gap-4">
          <div className="min-w-0">
            <label className="mb-1 block text-[10px] uppercase text-slate-500">
              {t("bank")}
            </label>
            <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-base font-semibold tabular-nums sm:px-3 sm:py-2 sm:text-lg">
              £{bank.toFixed(1)}m
            </div>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[10px] uppercase text-slate-500">
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
            <label className="text-[10px] uppercase text-slate-500">
              {t("captain")}
            </label>
            <select
              className="h-9 rounded-md border border-white/10 bg-brand-ink px-2 py-1 text-xs sm:h-auto sm:py-2 sm:text-sm"
              value={captainId ?? ""}
              onChange={(e) =>
                setCaptainId(Number(e.target.value) || null)
              }
            >
              {picks
                .filter((p) => p.is_starter)
                .map((p) => (
                  <option key={p.fpl_id} value={p.fpl_id}>
                    {p.web_name ?? p.fpl_id} ({p.position})
                  </option>
                ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-[10px] uppercase text-slate-500">
              {t("vice")}
            </label>
            <select
              className="h-9 rounded-md border border-white/10 bg-brand-ink px-2 py-1 text-xs sm:h-auto sm:py-2 sm:text-sm"
              value={viceId ?? ""}
              onChange={(e) =>
                setViceId(Number(e.target.value) || null)
              }
            >
              <option value="">—</option>
              {picks
                .filter((p) => p.is_starter && p.fpl_id !== captainId)
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

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-6 2xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 flex flex-col gap-5 sm:gap-6">
          <section className="flex flex-col gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="max-w-xl space-y-1 text-xs text-slate-500">
            <p>
              {t("hintPitchLead")}{" "}
              <strong>{t("hintBoldXi")}</strong>
              {t("hintPitchXiSuffix")}{" "}
              <strong>{t("hintBoldTransfer")}</strong>
              {t("hintPitchClose")}
            </p>
            <p className="text-[11px] text-slate-600">{t("hintTapProfile")}</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={resetToFplTeam}>
            {t("resetFpl")}
          </Button>
        </div>
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:gap-8">
          <PitchView
            title={t("pitchYourFpl")}
            caption={t("pitchYourFplCaption")}
            benchLabel={t("pitchBench")}
            benchGkAbbrev={t("pitchBenchGkAbbrev")}
            picks={sortedInitial}
            captainId={cap0}
            viceId={vice0}
            cardSublineByFplId={baselinePitchSubline}
            nextGwXpByFplId={baselineNextGwXpByFplId}
            nextGwXpTitle={pitchCardXpTitle}
            interactive
            onPickSlot={handleBaselineInspect}
          />
          <PitchView
            title={t("planningScenario")}
            benchLabel={t("pitchBench")}
            benchGkAbbrev={t("pitchBenchGkAbbrev")}
            caption={
              changedFromFpl.size > 0
                ? t("pitchPlanningCaptionDiff", {
                    n: changedFromFpl.size,
                    bank: bank.toFixed(1),
                  })
                : t("pitchPlanningCaptionSame", { bank: bank.toFixed(1) })
            }
            picks={picks}
            captainId={captainId}
            viceId={viceId}
            cardSublineByFplId={scenarioPitchSubline}
            nextGwXpByFplId={scenarioNextGwXpByFplId}
            nextGwXpTitle={pitchCardXpTitle}
            highlightSlots={changedFromFpl}
            reorderSelectedSlot={xiBenchMode ? xiFirst : null}
            interactive
            onPickSlot={handlePlanningInteraction}
          />
        </div>
      </section>

      {projMeta && Object.keys(projById).length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm sm:px-4 sm:py-4">
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-slate-500">
              {t("gwRange", {
                from: projMeta.fromGw,
                to: projMeta.toGw,
              })}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                {t("fplThisPage")}
              </p>
              <p className="mt-1 text-slate-400">
                {t("xiXpLine", {
                  value: baselineXiXp.toFixed(1),
                })}
              </p>
              <p className="text-slate-400">
                {t("benchLine", {
                  value: baselineBenchXp.toFixed(1),
                })}
              </p>
            </div>
            <div className="rounded-lg border border-brand-accent/25 bg-brand-accent/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-brand-accent">
                {t("planningScenario")}
              </p>
              <p className="mt-1 text-slate-300">
                {t("xiXpLine", {
                  value: xiXpDisplay.toFixed(1),
                })}
              </p>
              <p className="text-slate-400">
                {t("benchLine", {
                  value: benchXp.toFixed(1),
                })}
              </p>
              <p className="mt-2 border-t border-white/10 pt-2 text-[11px] text-slate-500">
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

      <section className="overflow-x-auto rounded-lg border border-white/10 bg-white/5 sm:rounded-xl">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase text-slate-400 sm:text-xs">
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
                  <span className="ml-1 text-slate-400 text-[10px]">
                    {t("tableBadgeVice")}
                  </span>
                ) : null;
              return (
                <tr
                  key={p.slot}
                  className={cn(
                    "border-t border-white/5",
                    p.is_starter ? "" : "opacity-80",
                    xiBenchMode && xiFirst === p.slot && "bg-sky-500/10",
                  )}
                >
                  <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                    {p.slot}
                    {!p.is_starter && (
                      <span className="ml-1 text-[10px] text-slate-500">
                        {t("benchTag")}
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 font-medium sm:px-2 sm:py-2">
                    {p.web_name ?? `#${p.fpl_id}`}
                    {cap}
                  </td>
                  <td className="px-1.5 py-1.5 text-slate-400 sm:px-2 sm:py-2">{p.position}</td>
                  <td className="px-1.5 py-1.5 text-slate-300 sm:px-2 sm:py-2">{p.team}</td>
                  <td className="px-1.5 py-1.5 sm:px-2 sm:py-2">
                    {p.base_price != null ? p.base_price.toFixed(1) : "–"}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-medium sm:px-2 sm:py-2">
                    {pr ? (
                      <>
                        {pr.xp_total.toFixed(1)}
                        {p.fpl_id === captainId && (
                          <span className="text-slate-500 text-xs">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
        </div>

        <PlannerTopXpSidebar
          loading={topsLoading}
          error={topsError}
          tops={topsByPos}
          fromGw={topsFromGw}
          toGw={topsToGw}
          horizon={topsHorizon}
        />
      </div>

      {swapSlot != null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/[0.1] bg-brand-ink p-4 shadow-2xl shadow-black/50 sm:rounded-2xl sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {t("replaceSlot", { slot: swapSlot })}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setSwapSlot(null)}>
                {t("close")}
              </Button>
            </div>
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQ}
              onChange={(e) => {
                const v = e.target.value;
                setSearchQ(v);
                void searchPlayers(v);
              }}
              autoFocus
            />
            <p className="text-[11px] text-slate-500 mt-2">
              {t("searchHint")}
            </p>
            <ul className="mt-3 flex flex-col gap-1">
              {searching && (
                <li className="text-sm text-slate-500">{t("searching")}</li>
              )}
              {!searching &&
                searchHits.map((h) => (
                  <li key={h.fpl_id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10"
                      onClick={() => applySwap(swapSlot, h)}
                    >
                      <span className="font-medium">{h.web_name ?? h.name}</span>
                      <span className="text-slate-400">
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
                    </button>
                  </li>
                ))}
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
