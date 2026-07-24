import type { PlannerPickPayload } from "@/components/planner/types";
import {
  createEmptySquad,
  normalizeEmptySquadFormation,
} from "@/lib/squad-builder/slots";

export type GwSquadState = {
  picks: PlannerPickPayload[];
  captainId: number | null;
  viceId: number | null;
};

export type SquadBuilderDraftV2 = {
  version: 2;
  planningGw: number;
  horizon: number;
  squads: Record<string, GwSquadState>;
};

const STORAGE_KEY_V2 = "squad-builder-draft-v2";
const STORAGE_KEY_V1 = "squad-builder-draft-v1";

function clonePicks(picks: PlannerPickPayload[]): PlannerPickPayload[] {
  return picks.map((p) => ({ ...p }));
}

function emptyGwState(): GwSquadState {
  return {
    picks: createEmptySquad(),
    captainId: null,
    viceId: null,
  };
}

function loadV1(): PlannerPickPayload[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlannerPickPayload[];
    if (!Array.isArray(parsed) || parsed.length !== 15) return null;
    return normalizeEmptySquadFormation(parsed);
  } catch {
    return null;
  }
}

function loadV2(): SquadBuilderDraftV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SquadBuilderDraftV2;
    if (parsed?.version !== 2 || !parsed.squads) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraftV2(draft: SquadBuilderDraftV2) {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

/** Build initial draft for the planning window, migrating v1 if present. */
export function loadOrCreateDraft(
  fromGw: number,
  horizon: number,
): SquadBuilderDraftV2 {
  const existing = loadV2();
  if (existing) {
    return {
      ...existing,
      horizon,
      planningGw: clampGw(existing.planningGw, fromGw, horizon),
    };
  }

  const migrated = loadV1();
  const picks = migrated ?? createEmptySquad();
  const key = String(fromGw);
  return {
    version: 2,
    planningGw: fromGw,
    horizon,
    squads: {
      [key]: {
        picks: clonePicks(picks),
        captainId: null,
        viceId: null,
      },
    },
  };
}

export function clampGw(gw: number, fromGw: number, horizon: number): number {
  const toGw = fromGw + horizon - 1;
  return Math.min(Math.max(gw, fromGw), toGw);
}

export function gwRange(fromGw: number, horizon: number): number[] {
  const out: number[] = [];
  for (let gw = fromGw; gw < fromGw + horizon; gw++) out.push(gw);
  return out;
}

/** Resolve squad for a GW, inheriting from the previous GW in-range when unset. */
export function resolveGwSquad(
  draft: SquadBuilderDraftV2,
  gw: number,
  fromGw: number,
): GwSquadState {
  const hit = draft.squads[String(gw)];
  if (hit) {
    return {
      picks: clonePicks(normalizeEmptySquadFormation(hit.picks)),
      captainId: hit.captainId,
      viceId: hit.viceId,
    };
  }

  for (let g = gw - 1; g >= fromGw; g--) {
    const prev = draft.squads[String(g)];
    if (prev) {
      return {
        picks: clonePicks(prev.picks),
        captainId: prev.captainId,
        viceId: prev.viceId,
      };
    }
  }

  return emptyGwState();
}

export function upsertGwSquad(
  draft: SquadBuilderDraftV2,
  gw: number,
  state: GwSquadState,
): SquadBuilderDraftV2 {
  return {
    ...draft,
    squads: {
      ...draft.squads,
      [String(gw)]: {
        picks: clonePicks(state.picks),
        captainId: state.captainId,
        viceId: state.viceId,
      },
    },
  };
}
