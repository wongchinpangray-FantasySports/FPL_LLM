import type { PlannerPickPayload } from "@/components/planner/types";
import { isFilledPick } from "@/lib/squad-builder/slots";

export type PlannerScenarioSlot = {
  picks: PlannerPickPayload[];
  captainId: number | null;
  viceId: number | null;
  bank: number;
};

export type PlannerScenarioDraftV1 = {
  version: 1;
  entryId: number;
  /** Invalidates saved scenarios when the FPL squad snapshot changes. */
  baselineKey: string;
  activeScenario: ScenarioIndex;
  scenarios: Record<string, PlannerScenarioSlot>;
};

export type ScenarioIndex = 1 | 2 | 3;

export const PLANNER_SCENARIO_COUNT = 3;

const STORAGE_PREFIX = "planner-scenario-draft-v1";

function storageKey(entryId: number): string {
  return `${STORAGE_PREFIX}:${entryId}`;
}

function clonePicks(picks: PlannerPickPayload[]): PlannerPickPayload[] {
  return picks.map((p) => ({ ...p }));
}

function baselineSlot(
  picks: PlannerPickPayload[],
  bank: number,
  captainId: number | null,
  viceId: number | null,
): PlannerScenarioSlot {
  return {
    picks: clonePicks(picks),
    captainId,
    viceId,
    bank,
  };
}

export function scenarioIndexRange(): ScenarioIndex[] {
  return [1, 2, 3];
}

export function clampScenarioIndex(index: number): ScenarioIndex {
  const n = Math.floor(index) || 1;
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return n as ScenarioIndex;
}

export function scenarioLetter(index: ScenarioIndex): string {
  return String.fromCharCode(64 + index);
}

export function isPlannerScenarioDraftV1(
  value: unknown,
): value is PlannerScenarioDraftV1 {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<PlannerScenarioDraftV1>;
  return (
    d.version === 1 &&
    typeof d.entryId === "number" &&
    typeof d.baselineKey === "string" &&
    !!d.scenarios &&
    typeof d.scenarios === "object"
  );
}

export function normalizeScenarioDraft(
  draft: PlannerScenarioDraftV1,
  fallback: PlannerScenarioSlot,
): PlannerScenarioDraftV1 {
  const scenarios: Record<string, PlannerScenarioSlot> = {};
  for (const i of scenarioIndexRange()) {
    const hit = draft.scenarios[String(i)];
    scenarios[String(i)] = hit
      ? {
          picks: clonePicks(hit.picks ?? fallback.picks),
          captainId: hit.captainId ?? null,
          viceId: hit.viceId ?? null,
          bank:
            typeof hit.bank === "number" && Number.isFinite(hit.bank)
              ? hit.bank
              : fallback.bank,
        }
      : { ...fallback, picks: clonePicks(fallback.picks) };
  }
  return {
    version: 1,
    entryId: draft.entryId,
    baselineKey: draft.baselineKey,
    activeScenario: clampScenarioIndex(draft.activeScenario ?? 1),
    scenarios,
  };
}

export function createScenarioDraftFromBaseline(
  entryId: number,
  baselineKey: string,
  picks: PlannerPickPayload[],
  bank: number,
  captainId: number | null,
  viceId: number | null,
): PlannerScenarioDraftV1 {
  const slot = baselineSlot(picks, bank, captainId, viceId);
  const scenarios: Record<string, PlannerScenarioSlot> = {};
  for (const i of scenarioIndexRange()) {
    scenarios[String(i)] = {
      ...slot,
      picks: clonePicks(slot.picks),
    };
  }
  return {
    version: 1,
    entryId,
    baselineKey,
    activeScenario: 1,
    scenarios,
  };
}

export function resolveScenarioSlot(
  draft: PlannerScenarioDraftV1,
  index: ScenarioIndex,
): PlannerScenarioSlot {
  const hit = draft.scenarios[String(clampScenarioIndex(index))];
  if (!hit) {
    const first = draft.scenarios["1"];
    return first
      ? {
          picks: clonePicks(first.picks),
          captainId: first.captainId,
          viceId: first.viceId,
          bank: first.bank,
        }
      : {
          picks: [],
          captainId: null,
          viceId: null,
          bank: 0,
        };
  }
  return {
    picks: clonePicks(hit.picks),
    captainId: hit.captainId,
    viceId: hit.viceId,
    bank: hit.bank,
  };
}

export function upsertScenarioSlot(
  draft: PlannerScenarioDraftV1,
  index: ScenarioIndex,
  state: PlannerScenarioSlot,
): PlannerScenarioDraftV1 {
  const key = String(clampScenarioIndex(index));
  return {
    ...draft,
    scenarios: {
      ...draft.scenarios,
      [key]: {
        picks: clonePicks(state.picks),
        captainId: state.captainId,
        viceId: state.viceId,
        bank: state.bank,
      },
    },
  };
}

export function scenarioHasAnyChanges(draft: PlannerScenarioDraftV1): boolean {
  const base = draft.scenarios["1"];
  if (!base) return false;
  for (const i of scenarioIndexRange()) {
    const slot = draft.scenarios[String(i)];
    if (!slot) continue;
    if (slot.bank !== base.bank) return true;
    for (const p of slot.picks) {
      const b = base.picks.find((x) => x.slot === p.slot);
      if (!b || b.fpl_id !== p.fpl_id || b.is_starter !== p.is_starter) {
        return true;
      }
    }
  }
  return false;
}

/** Horizon xPt for a saved scenario when projections exist. */
export function scenarioHorizonXpt(
  draft: PlannerScenarioDraftV1,
  index: ScenarioIndex,
  projById: Record<string, { by_gw?: { gw: number; xp: number }[] }>,
  fromGw: number,
  toGw: number,
): number | null {
  const slot = resolveScenarioSlot(draft, index);
  if (slot.picks.length !== 15) return null;

  const starters = slot.picks.filter((p) => p.is_starter && isFilledPick(p));
  if (starters.length !== 11) return null;

  let total = 0;
  for (let gw = fromGw; gw <= toGw; gw++) {
    for (const p of starters) {
      const cell = projById[String(p.fpl_id)]?.by_gw?.find((c) => c.gw === gw);
      if (cell?.xp == null || !Number.isFinite(cell.xp)) return null;
      const mult =
        slot.captainId != null && p.fpl_id === slot.captainId ? 2 : 1;
      total += cell.xp * mult;
    }
  }
  return Math.round(total * 10) / 10;
}

export function loadScenarioDraftLocal(
  entryId: number,
): PlannerScenarioDraftV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(entryId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlannerScenarioDraftV1;
    if (!isPlannerScenarioDraftV1(parsed) || parsed.entryId !== entryId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveScenarioDraftLocal(draft: PlannerScenarioDraftV1) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(draft.entryId), JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

export type ScenarioDraftFetch =
  | { status: "ok"; draft: PlannerScenarioDraftV1 | null; updated_at: string | null }
  | { status: "unauthorized" }
  | { status: "unavailable" }
  | { status: "error" };

export async function fetchScenarioDraftAccount(
  entryId: number,
): Promise<ScenarioDraftFetch> {
  try {
    const res = await fetch(
      `/api/planner/scenario-draft?entryId=${entryId}`,
      { cache: "no-store" },
    );
    if (res.status === 401) return { status: "unauthorized" };
    if (res.status === 503) return { status: "unavailable" };
    if (!res.ok) return { status: "error" };
    const data = (await res.json()) as {
      draft?: unknown;
      updated_at?: string | null;
    };
    if (!isPlannerScenarioDraftV1(data.draft)) {
      return { status: "ok", draft: null, updated_at: null };
    }
    const draft = data.draft;
    if (draft.entryId !== entryId) {
      return { status: "ok", draft: null, updated_at: null };
    }
    return {
      status: "ok",
      draft,
      updated_at: data.updated_at ?? null,
    };
  } catch {
    return { status: "error" };
  }
}

async function putScenarioDraftAccount(
  entryId: number,
  draft: PlannerScenarioDraftV1,
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/planner/scenario-draft?entryId=${entryId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveScenarioDraftAccount(
  entryId: number,
  draft: PlannerScenarioDraftV1,
): Promise<boolean> {
  saveScenarioDraftLocal(draft);
  return putScenarioDraftAccount(entryId, draft);
}

/**
 * Prefer account draft when baselineKey matches; migrate local when account empty.
 */
export async function hydrateScenarioDraftFromAccount(
  entryId: number,
  baselineKey: string,
  picks: PlannerPickPayload[],
  bank: number,
  captainId: number | null,
  viceId: number | null,
): Promise<PlannerScenarioDraftV1> {
  const fallback = baselineSlot(picks, bank, captainId, viceId);
  const fresh = createScenarioDraftFromBaseline(
    entryId,
    baselineKey,
    picks,
    bank,
    captainId,
    viceId,
  );

  const localRaw = loadScenarioDraftLocal(entryId);
  const local =
    localRaw && localRaw.baselineKey === baselineKey
      ? normalizeScenarioDraft(localRaw, fallback)
      : null;

  const remote = await fetchScenarioDraftAccount(entryId);
  if (remote.status !== "ok") {
    return local ?? fresh;
  }

  if (remote.draft && remote.draft.baselineKey === baselineKey) {
    const merged = normalizeScenarioDraft(remote.draft, fallback);
    saveScenarioDraftLocal(merged);
    return merged;
  }

  if (local && scenarioHasAnyChanges(local)) {
    const normalized = normalizeScenarioDraft(local, fallback);
    saveScenarioDraftLocal(normalized);
    void putScenarioDraftAccount(entryId, normalized);
    return normalized;
  }

  if (remote.draft) {
    const merged = normalizeScenarioDraft(remote.draft, fallback);
    saveScenarioDraftLocal(merged);
    return merged;
  }

  return fresh;
}
