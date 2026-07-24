"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PitchView, type PlannerGwStripCell } from "@/components/planner/pitch-view";
import type { PlannerPickPayload } from "@/components/planner/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { findBestXiByXp } from "@/lib/planner/optimize-xi";
import {
  canAfford,
  swapBudget,
  validatePlannerSquad,
  validateXiFormation,
  type ValidationIssue,
} from "@/lib/planner/validate";
import { formatSquadBuilderIssue } from "@/lib/squad-builder/format-issue";
import { SquadBuilderListView } from "@/components/squad-builder/squad-builder-list-view";
import {
  SquadBuilderPlayerPanel,
  type BrowsePlayer,
} from "@/components/squad-builder/squad-builder-player-panel";
import { SquadBuilderStatsBar } from "@/components/squad-builder/squad-builder-stats-bar";
import {
  createEmptySquad,
  filledPicks,
  isFilledPick,
  normalizeEmptySquadFormation,
  slotPosition,
  squadBankM,
  squadSpendM,
  SQUAD_BUILDER_BUDGET_M,
} from "@/lib/squad-builder/slots";
import {
  computeSquadGwXpt,
  horizonTotalXpt,
} from "@/lib/squad-builder/xp-totals";

const STORAGE_KEY = "squad-builder-draft-v1";

type ProjRow = {
  xp_total: number;
  xp_next_gw: number;
  by_gw: { gw: number; opp: string; xp: number }[];
};

type TeamOption = { id: number; short_name: string; name: string };

type ViewMode = "pitch" | "list";
type Mode = "captain" | "xi" | null;

function loadDraft(): PlannerPickPayload[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlannerPickPayload[];
    if (!Array.isArray(parsed) || parsed.length !== 15) return null;
    return normalizeEmptySquadFormation(parsed);
  } catch {
    return null;
  }
}

function saveDraft(picks: PlannerPickPayload[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
  } catch {
    /* ignore */
  }
}

function firstEmptySlot(picks: PlannerPickPayload[]): number | null {
  const empty = picks.find((p) => !isFilledPick(p));
  return empty?.slot ?? null;
}

export function SquadBuilderApp({ teams }: { teams: TeamOption[] }) {
  const t = useTranslations("squadBuilderApp");

  const [picks, setPicks] = useState<PlannerPickPayload[]>(() =>
    loadDraft() ?? createEmptySquad(),
  );
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceId, setViceId] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(() =>
    firstEmptySlot(loadDraft() ?? createEmptySquad()),
  );
  const [viewMode, setViewMode] = useState<ViewMode>("pitch");
  const [mode, setMode] = useState<Mode>(null);
  const [xiFirst, setXiFirst] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [horizon, setHorizon] = useState(5);
  const [projById, setProjById] = useState<Record<string, ProjRow>>({});
  const [projMeta, setProjMeta] = useState<{ fromGw: number; toGw: number } | null>(
    null,
  );
  const [projLoading, setProjLoading] = useState(false);
  const [projError, setProjError] = useState<string | null>(null);

  useEffect(() => {
    saveDraft(picks);
  }, [picks]);

  const filled = useMemo(() => filledPicks(picks), [picks]);
  const spend = useMemo(() => squadSpendM(picks), [picks]);
  const bank = useMemo(() => squadBankM(picks), [picks]);
  const squadFplIds = useMemo(
    () => new Set(filled.map((p) => p.fpl_id)),
    [filled],
  );
  const squadValid =
    filled.length === 15 && validatePlannerSquad(filled).length === 0;

  const squadIssues = useMemo(() => {
    if (filled.length === 0) return [];
    const issues: ValidationIssue[] = [];
    if (filled.length < 15) {
      issues.push({ code: "size", message: "", values: { have: filled.length } });
    }
    if (filled.length === 15) {
      issues.push(...validatePlannerSquad(filled));
    }
    if (spend > SQUAD_BUILDER_BUDGET_M + 0.05) {
      issues.push({
        code: "budget",
        message: "",
        values: { spent: spend.toFixed(1), budget: String(SQUAD_BUILDER_BUDGET_M) },
      });
    }
    return issues;
  }, [filled, spend]);

  const gwTotals = useMemo(() => {
    if (!projMeta || Object.keys(projById).length === 0) return [];
    return computeSquadGwXpt(
      picks,
      projById,
      captainId,
      projMeta.fromGw,
      projMeta.toGw,
    );
  }, [picks, projById, captainId, projMeta]);

  const nextGwXpt = gwTotals[0]?.xpt ?? null;
  const horizonXpt = gwTotals.length > 0 ? horizonTotalXpt(gwTotals) : null;

  const gwForecastByFplId = useMemo(() => {
    const out: Record<number, PlannerGwStripCell[]> = {};
    for (const [id, pr] of Object.entries(projById)) {
      if (pr.by_gw?.length) out[Number(id)] = pr.by_gw.slice(0, 5);
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }, [projById]);

  const nextGwXpByFplId = useMemo(() => {
    if (!projMeta) return undefined;
    const out: Record<number, number> = {};
    for (const p of picks) {
      if (!isFilledPick(p)) continue;
      const pr = projById[String(p.fpl_id)];
      const base = pr?.xp_next_gw;
      if (base == null || !Number.isFinite(base)) continue;
      const mult =
        p.is_starter && captainId != null && p.fpl_id === captainId ? 2 : 1;
      out[p.fpl_id] = Math.round(base * mult * 10) / 10;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }, [picks, projById, projMeta, captainId]);

  const runProject = useCallback(async () => {
    if (filled.length !== 15 || validatePlannerSquad(filled).length > 0) return;
    setProjLoading(true);
    setProjError(null);
    try {
      const res = await fetch("/api/planner/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerIds: filled.map((p) => p.fpl_id),
          horizon,
          includeLeagueTops: false,
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
        return;
      }
      setProjById(data.projections ?? {});
      setProjMeta(
        data.fromGw != null && data.toGw != null
          ? { fromGw: data.fromGw, toGw: data.toGw }
          : null,
      );
    } catch {
      setProjError(t("errProjectionFailed"));
    } finally {
      setProjLoading(false);
    }
  }, [filled, horizon, t]);

  useEffect(() => {
    if (!squadValid) return;
    const timer = setTimeout(() => void runProject(), 600);
    return () => clearTimeout(timer);
  }, [squadValid, filled, horizon, runProject]);

  function fixCaptainVice(next: PlannerPickPayload[]) {
    const ids = new Set(next.filter(isFilledPick).map((p) => p.fpl_id));
    if (captainId != null && !ids.has(captainId)) setCaptainId(null);
    if (viceId != null && !ids.has(viceId)) setViceId(null);
    const starters = next.filter((p) => p.is_starter && isFilledPick(p));
    if (starters.length > 0 && captainId == null) {
      setCaptainId(starters[0].fpl_id);
    }
  }

  function applyPlayerToSlot(slot: number, p: BrowsePlayer) {
    const needPos = slotPosition(slot);
    if (needPos && p.position !== needPos) {
      setNotice(t("valPosMismatch", { pos: p.position ?? "?", need: needPos }));
      return;
    }
    const row = picks.find((x) => x.slot === slot);
    if (!row) return;
    if (squadFplIds.has(p.fpl_id)) {
      setNotice(t("errAlreadyInSquad"));
      return;
    }
    const outPrice = isFilledPick(row) ? row.base_price : 0;
    const newBank = swapBudget(bank, outPrice, p.base_price);
    if (!canAfford(newBank)) {
      setNotice(
        t("errBudget", {
          need: ((p.base_price ?? 0) - bank).toFixed(1),
          bank: bank.toFixed(1),
        }),
      );
      return;
    }
    const nextRow: PlannerPickPayload = {
      ...row,
      fpl_id: p.fpl_id,
      web_name: p.web_name ?? p.name,
      team: p.team,
      team_id: p.team_id,
      position: p.position,
      base_price: p.base_price,
    };
    const draft = picks.map((r) => (r.slot === slot ? nextRow : r));
    const trialFilled = filledPicks(draft);
    if (trialFilled.length === 15) {
      const vIssues = validatePlannerSquad(trialFilled);
      if (vIssues.length > 0) {
        setNotice(formatSquadBuilderIssue(vIssues[0], t));
        return;
      }
    }
    setPicks(draft);
    setNotice(null);
    fixCaptainVice(draft);
    setSelectedSlot(firstEmptySlot(draft));
  }

  function removePlayer(slot: number) {
    const row = picks.find((p) => p.slot === slot);
    if (!row || !isFilledPick(row)) return;
    const empty = createEmptySquad().find((p) => p.slot === slot)!;
    const next = picks.map((p) =>
      p.slot === slot ? { ...empty, is_starter: row.is_starter } : p,
    );
    if (captainId === row.fpl_id) setCaptainId(null);
    if (viceId === row.fpl_id) setViceId(null);
    setPicks(next);
    setSelectedSlot(slot);
  }

  function onPickSlot(slot: number) {
    setSelectedSlot(slot);
    const row = picks.find((p) => p.slot === slot);
    if (!row) return;

    if (mode === "captain") {
      if (!isFilledPick(row) || !row.is_starter) return;
      if (captainId === row.fpl_id) setCaptainId(null);
      else {
        setCaptainId(row.fpl_id);
        if (viceId === row.fpl_id) setViceId(null);
      }
      return;
    }

    if (mode === "xi") {
      if (!isFilledPick(row)) return;
      if (xiFirst == null) {
        setXiFirst(slot);
        return;
      }
      if (xiFirst === slot) {
        setXiFirst(null);
        return;
      }
      const a = picks.find((p) => p.slot === xiFirst);
      const b = row;
      if (!a || !isFilledPick(a) || !isFilledPick(b)) {
        setXiFirst(null);
        return;
      }
      const next = picks.map((p) => {
        if (p.slot === a.slot) return { ...p, is_starter: b.is_starter };
        if (p.slot === b.slot) return { ...p, is_starter: a.is_starter };
        return p;
      });
      const starters = next.filter((p) => p.is_starter && isFilledPick(p));
      if (validateXiFormation(starters).length > 0) {
        setNotice(t("errInvalidXiSwap"));
        setXiFirst(null);
        return;
      }
      setPicks(next);
      setXiFirst(null);
      fixCaptainVice(next);
      return;
    }
  }

  function applyBestXi() {
    if (Object.keys(projById).length === 0) {
      setProjError(t("errRefreshXpFirst"));
      return;
    }
    const xpMap: Record<string, number> = {};
    for (const p of filled) {
      const pr = projById[String(p.fpl_id)];
      if (pr) xpMap[String(p.fpl_id)] = pr.xp_total;
    }
    const best = findBestXiByXp(filled, xpMap);
    if (!best || best.length !== 11) {
      setProjError(t("errNoValidXi"));
      return;
    }
    const setIds = new Set(best);
    const next = picks.map((p) => ({
      ...p,
      is_starter: isFilledPick(p) ? setIds.has(p.fpl_id) : p.is_starter,
    }));
    setPicks(next);
    fixCaptainVice(next);
    setProjError(null);
  }

  function resetSquad() {
    const empty = createEmptySquad();
    setPicks(empty);
    setCaptainId(null);
    setViceId(null);
    setProjById({});
    setProjMeta(null);
    setMode(null);
    setSelectedSlot(firstEmptySlot(empty));
    setNotice(null);
    setProjError(null);
  }

  const pitchPicks = picks.map((p) =>
    isFilledPick(p)
      ? p
      : { ...p, web_name: t("emptyPlayer"), base_price: 0 },
  );

  const panelLabels = {
    title: t("panelTitle"),
    search: t("searchPlaceholder"),
    positionAll: t("filterPositionAll"),
    clubAll: t("filterClubAll"),
    sortPrice: t("sortPrice"),
    sortPoints: t("sortPoints"),
    sortOwnership: t("sortOwnership"),
    sortForm: t("sortForm"),
    colName: t("colName"),
    colOwn: t("colOwn"),
    colPrice: t("colPrice"),
    colXpts: t("colXpts"),
    inSquad: t("inSquad"),
    loading: t("panelLoading"),
    empty: t("panelEmpty"),
  };

  const listLabels = {
    colName: t("colName"),
    colOwn: t("colOwn"),
    colPrice: t("colPrice"),
    colPts: t("colPts"),
    colXpts: t("colXpts"),
    colXi: t("colXi"),
    emptyPlayer: t("emptyPlayer"),
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <section className="flex flex-col gap-4 border-b border-border pb-5">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-brand-accent sm:text-xs">
            {t("eyebrow")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <SquadBuilderStatsBar
          bank={bank}
          spend={spend}
          budget={SQUAD_BUILDER_BUDGET_M}
          xptsNextGw={nextGwXpt}
          xptsHorizon={horizonXpt}
          nextGwLabel={
            projMeta
              ? t("nextGwLabel", { gw: projMeta.fromGw })
              : t("nextGwPending")
          }
          labels={{
            bank: t("budgetLabel"),
            cost: t("spentLabel"),
            xpts: t("xptsLabel"),
            xptsHorizon: t("xptsHorizonLabel"),
          }}
        />
      </section>

      {squadIssues.length > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          {formatSquadBuilderIssue(squadIssues[0], t)}
        </div>
      ) : squadValid ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100/90">
          {t("squadValid")}
        </div>
      ) : null}

      {notice ? <p className="text-sm text-rose-300/90">{notice}</p> : null}
      {projError ? <p className="text-sm text-rose-300/90">{projError}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "pitch"
                ? "bg-brand-accent/15 text-foreground"
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
                ? "bg-brand-accent/15 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setViewMode("list")}
          >
            {t("viewList")}
          </button>
        </div>
        <Button
          type="button"
          variant={mode === "captain" ? "primary" : "secondary"}
          size="sm"
          onClick={() => {
            setMode(mode === "captain" ? null : "captain");
            setXiFirst(null);
          }}
        >
          {t("modeCaptain")}
        </Button>
        <Button
          type="button"
          variant={mode === "xi" ? "primary" : "secondary"}
          size="sm"
          onClick={() => {
            setMode(mode === "xi" ? null : "xi");
            setXiFirst(null);
          }}
        >
          {t("modeXiBench")}
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("horizon")}
          <select
            className="rounded-md border border-border bg-card px-2 py-1 text-foreground"
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
          >
            {[3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} GW
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          size="sm"
          disabled={!squadValid || projLoading}
          onClick={() => void runProject()}
        >
          {projLoading ? t("projecting") : t("refreshXp")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!squadValid}
          onClick={applyBestXi}
        >
          {t("optimiseTeam")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={resetSquad}>
          {t("removeAll")}
        </Button>
      </div>

      {gwTotals.length > 0 && projMeta ? (
        <section className="rounded-xl border border-border bg-card/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {t("xptTitle", { from: projMeta.fromGw, to: projMeta.toGw })}
          </h2>
          <div className="flex flex-wrap gap-2">
            {gwTotals.map((row) => (
              <div
                key={row.gw}
                className="min-w-[4.5rem] rounded-lg border border-border bg-muted/30 px-3 py-2 text-center"
              >
                <div className="text-[10px] uppercase text-muted-foreground">
                  GW{row.gw}
                </div>
                <div className="text-lg font-semibold tabular-nums text-brand-accent">
                  {row.xpt.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(18rem,22rem)]">
        <div className="min-w-0">
          {viewMode === "pitch" ? (
            <PitchView
              picks={pitchPicks}
              title={t("pitchTitle", { filled: filled.length })}
              caption={
                mode === "captain"
                  ? t("captainHint")
                  : mode === "xi"
                    ? t("xiHint")
                    : t("pitchHint")
              }
              captainId={captainId}
              viceId={viceId}
              interactive
              reorderSelectedSlot={xiFirst ?? selectedSlot}
              onPickSlot={onPickSlot}
              gwForecastByFplId={gwForecastByFplId}
              nextGwXpByFplId={nextGwXpByFplId}
              nextGwXpTitle={t("nextGwXpTitle", { gw: projMeta?.fromGw ?? "–" })}
              benchLabel={t("benchLabel")}
              benchGkAbbrev={t("benchGk")}
            />
          ) : (
            <SquadBuilderListView
              picks={picks}
              captainId={captainId}
              viceId={viceId}
              projById={projById}
              selectedSlot={selectedSlot}
              onSelectSlot={(slot) => {
                setSelectedSlot(slot);
                onPickSlot(slot);
              }}
              labels={listLabels}
            />
          )}

          {selectedSlot != null && isFilledPick(picks.find((p) => p.slot === selectedSlot)!) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const row = picks.find((p) => p.slot === selectedSlot);
                  if (row?.is_starter) setCaptainId(row.fpl_id);
                }}
              >
                {t("makeCaptain")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const row = picks.find((p) => p.slot === selectedSlot);
                  if (row?.is_starter) setViceId(row.fpl_id);
                }}
              >
                {t("makeVice")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-rose-300"
                onClick={() => removePlayer(selectedSlot)}
              >
                {t("removePlayer")}
              </Button>
            </div>
          ) : null}
        </div>

        <SquadBuilderPlayerPanel
          selectedSlot={selectedSlot}
          slotPosition={
            selectedSlot != null ? slotPosition(selectedSlot) : null
          }
          bank={bank}
          projById={projById}
          squadFplIds={squadFplIds}
          teams={teams}
          onPickPlayer={(p) => {
            const slot =
              selectedSlot ?? firstEmptySlot(picks) ?? picks[0]?.slot ?? 1;
            applyPlayerToSlot(slot, p);
          }}
          labels={panelLabels}
        />
      </div>
    </div>
  );
}
