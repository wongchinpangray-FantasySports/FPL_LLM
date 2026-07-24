"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PitchView, type PlannerGwStripCell } from "@/components/planner/pitch-view";
import type { PlannerPickPayload } from "@/components/planner/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findBestXiByXp } from "@/lib/planner/optimize-xi";
import {
  canAfford,
  roundMoney,
  swapBudget,
  validatePlannerSquad,
  validateXiFormation,
  type ValidationIssue,
} from "@/lib/planner/validate";
import { formatSquadBuilderIssue } from "@/lib/squad-builder/format-issue";
import {
  createEmptySquad,
  filledPicks,
  isFilledPick,
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

type SearchPlayer = {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
};

type ProjRow = {
  xp_total: number;
  xp_next_gw: number;
  by_gw: { gw: number; opp: string; xp: number }[];
};

type Mode = "add" | "captain" | "xi" | null;

function loadDraft(): PlannerPickPayload[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlannerPickPayload[];
    if (!Array.isArray(parsed) || parsed.length !== 15) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(picks: PlannerPickPayload[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
  } catch {
    /* ignore quota */
  }
}

export function SquadBuilderApp() {
  const t = useTranslations("squadBuilderApp");

  const [picks, setPicks] = useState<PlannerPickPayload[]>(() =>
    loadDraft() ?? createEmptySquad(),
  );
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceId, setViceId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [addSlot, setAddSlot] = useState<number | null>(null);
  const [xiFirst, setXiFirst] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchPlayer[]>([]);
  const [searching, setSearching] = useState(false);
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
  const squadValid =
    filled.length === 15 && validatePlannerSquad(filled).length === 0;

  const squadIssues = useMemo(() => {
    if (filled.length === 0) return [];
    const issues: ValidationIssue[] = [];
    if (filled.length < 15) {
      issues.push({
        code: "size",
        message: "",
        values: { have: filled.length },
      });
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

  const searchPlayers = useCallback(async (q: string, slot: number | null) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSearchHits([]);
      return;
    }
    setSearching(true);
    try {
      const pos = slot != null ? slotPosition(slot) : null;
      const params = new URLSearchParams({ q: trimmed });
      if (pos) params.set("position", pos);
      if (bank > 0) params.set("max_price", String(bank));
      const res = await fetch(`/api/planner/players?${params}`);
      const data = (await res.json()) as { players?: SearchPlayer[] };
      setSearchHits(data.players ?? []);
    } catch {
      setSearchHits([]);
    } finally {
      setSearching(false);
    }
  }, [bank]);

  useEffect(() => {
    if (addSlot == null) return;
    const timer = setTimeout(() => {
      void searchPlayers(searchQ, addSlot);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQ, addSlot, searchPlayers]);

  function fixCaptainVice(next: PlannerPickPayload[]) {
    const ids = new Set(next.filter(isFilledPick).map((p) => p.fpl_id));
    if (captainId != null && !ids.has(captainId)) setCaptainId(null);
    if (viceId != null && !ids.has(viceId)) setViceId(null);
    const starters = next.filter((p) => p.is_starter && isFilledPick(p));
    if (starters.length > 0 && captainId == null) {
      setCaptainId(starters[0].fpl_id);
    }
  }

  function openAddSlot(slot: number) {
    setMode("add");
    setAddSlot(slot);
    setSearchQ("");
    setSearchHits([]);
    setNotice(null);
  }

  function closeAddModal() {
    setMode(null);
    setAddSlot(null);
    setSearchQ("");
    setSearchHits([]);
  }

  function applyPlayer(slot: number, p: SearchPlayer) {
    const needPos = slotPosition(slot);
    if (needPos && p.position !== needPos) {
      setNotice(t("valPosMismatch", { pos: p.position ?? "?", need: needPos }));
      return;
    }

    const row = picks.find((x) => x.slot === slot);
    if (!row) return;

    const taken = new Set(filled.map((x) => x.fpl_id));
    if (taken.has(p.fpl_id)) {
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
    setProjById({});
    setProjMeta(null);
    setNotice(null);
    fixCaptainVice(draft);
    closeAddModal();
  }

  function removePlayer(slot: number) {
    const row = picks.find((p) => p.slot === slot);
    if (!row || !isFilledPick(row)) return;
    const empty = createEmptySquad().find((p) => p.slot === slot)!;
    const next = picks.map((p) =>
      p.slot === slot
        ? { ...empty, is_starter: row.is_starter }
        : p,
    );
    if (captainId === row.fpl_id) setCaptainId(null);
    if (viceId === row.fpl_id) setViceId(null);
    setPicks(next);
    setProjById({});
    setProjMeta(null);
  }

  function onPickSlot(slot: number) {
    const row = picks.find((p) => p.slot === slot);
    if (!row) return;

    if (mode === "captain") {
      if (!isFilledPick(row) || !row.is_starter) return;
      if (captainId === row.fpl_id) {
        setCaptainId(null);
      } else {
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
      setNotice(null);
      fixCaptainVice(next);
      return;
    }

    if (isFilledPick(row)) {
      openAddSlot(slot);
    } else {
      openAddSlot(slot);
    }
  }

  async function runProject() {
    if (!squadValid) {
      setProjError(t("errFixSquadXp"));
      return;
    }
    setProjLoading(true);
    setProjError(null);
    try {
      const ids = filled.map((p) => p.fpl_id);
      const res = await fetch("/api/planner/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerIds: ids,
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
    setPicks(createEmptySquad());
    setCaptainId(null);
    setViceId(null);
    setProjById({});
    setProjMeta(null);
    setMode(null);
    setAddSlot(null);
    setNotice(null);
    setProjError(null);
  }

  const pitchPicks = picks.map((p) =>
    isFilledPick(p)
      ? p
      : {
          ...p,
          web_name: t("emptySlot"),
          base_price: 0,
        },
  );

  const pitchTitle = t("pitchTitle", {
    filled: filled.length,
  });

  return (
    <div className="flex flex-col gap-5 sm:gap-6 md:gap-8">
      <section className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5 sm:pb-6">
        <div className="max-w-2xl">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-brand-accent sm:text-xs">
            {t("eyebrow")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase text-muted-foreground">
              {t("budgetLabel")}
            </div>
            <div className="font-semibold tabular-nums">
              £{roundMoney(bank).toFixed(1)}m
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase text-muted-foreground">
              {t("spentLabel")}
            </div>
            <div className="font-semibold tabular-nums">
              £{spend.toFixed(1)}m / £{SQUAD_BUILDER_BUDGET_M.toFixed(1)}m
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase text-muted-foreground">
              {t("squadLabel")}
            </div>
            <div className="font-semibold tabular-nums">
              {filled.length}/15
            </div>
          </div>
        </div>
      </section>

      {squadIssues.length > 0 ? (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90"
          role="status"
        >
          {formatSquadBuilderIssue(squadIssues[0], t)}
        </div>
      ) : squadValid ? (
        <div
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100/90"
          role="status"
        >
          {t("squadValid")}
        </div>
      ) : null}

      {notice ? (
        <p className="text-sm text-rose-300/90" role="alert">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
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
          {t("bestXi")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={resetSquad}>
          {t("resetSquad")}
        </Button>
      </div>

      {projError ? (
        <p className="text-sm text-rose-300/90">{projError}</p>
      ) : null}

      {gwTotals.length > 0 && projMeta ? (
        <section className="rounded-xl border border-border bg-card/60 p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {t("xptTitle", {
                from: projMeta.fromGw,
                to: projMeta.toGw,
              })}
            </h2>
            <span className="text-sm font-semibold tabular-nums text-brand-accent">
              {t("xptTotal", { total: horizonTotalXpt(gwTotals) })}
            </span>
          </div>
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
                <div className="text-[10px] text-muted-foreground">xPt</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("xptHint")}</p>
        </section>
      ) : null}

      <PitchView
        picks={pitchPicks}
        title={pitchTitle}
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
        reorderSelectedSlot={xiFirst}
        onPickSlot={onPickSlot}
        gwForecastByFplId={gwForecastByFplId}
        nextGwXpByFplId={nextGwXpByFplId}
        nextGwXpTitle={t("nextGwXpTitle", { gw: projMeta?.fromGw ?? "–" })}
        benchLabel={t("benchLabel")}
        benchGkAbbrev={t("benchGk")}
      />

      {addSlot != null ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={closeAddModal}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold text-foreground">
                {t("addPlayerTitle", {
                  slot: addSlot,
                  pos: slotPosition(addSlot) ?? "?",
                })}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("addPlayerHint", { bank: bank.toFixed(1) })}
              </p>
              <Input
                className="mt-3"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder={t("searchPlaceholder")}
                autoFocus
              />
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {searching ? (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {t("searching")}
                </li>
              ) : searchHits.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {searchQ.trim().length < 2
                    ? t("searchMin")
                    : t("searchEmpty")}
                </li>
              ) : (
                searchHits.map((p) => (
                  <li key={p.fpl_id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-4 py-3 text-left hover:bg-muted/40"
                      onClick={() => applyPlayer(addSlot, p)}
                    >
                      <span>
                        <span className="font-medium text-foreground">
                          {p.web_name ?? p.name}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.team} · {p.position}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-brand-accent">
                        £{(p.base_price ?? 0).toFixed(1)}m
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="flex justify-between gap-2 border-t border-border px-4 py-3">
              {isFilledPick(picks.find((x) => x.slot === addSlot)!) ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="text-rose-300 hover:text-rose-200"
                  onClick={() => {
                    removePlayer(addSlot);
                    closeAddModal();
                  }}
                >
                  {t("removePlayer")}
                </Button>
              ) : (
                <span />
              )}
              <Button type="button" variant="secondary" size="sm" onClick={closeAddModal}>
                {t("close")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
