import type { PlannerPickPayload } from "@/components/planner/types";
import {
  createEmptySquad,
  filledPicks,
  isFilledPick,
  normalizeEmptySquadFormation,
} from "@/lib/squad-builder/slots";

export type DraftSlotState = {
  picks: PlannerPickPayload[];
  captainId: number | null;
  viceId: number | null;
};

/** @deprecated Use DraftSlotState */
export type GwSquadState = DraftSlotState;

export type SquadBuilderDraftV3 = {
  version: 3;
  activeDraft: number;
  horizon: number;
  drafts: Record<string, DraftSlotState>;
};

type SquadBuilderDraftV2 = {
  version: 2;
  planningGw: number;
  horizon: number;
  squads: Record<string, DraftSlotState>;
};

export const SQUAD_BUILDER_DRAFT_COUNT = 5;

const STORAGE_KEY_V3 = "squad-builder-draft-v3";
const STORAGE_KEY_V2 = "squad-builder-draft-v2";
const STORAGE_KEY_V1 = "squad-builder-draft-v1";

function clonePicks(picks: PlannerPickPayload[]): PlannerPickPayload[] {
  return picks.map((p) => ({ ...p }));
}

function emptyDraftSlot(): DraftSlotState {
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

function loadV3(): SquadBuilderDraftV3 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V3);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SquadBuilderDraftV3;
    if (parsed?.version !== 3 || !parsed.drafts) return null;
    return parsed;
  } catch {
    return null;
  }
}

function resolveGwSquadV2(
  draft: SquadBuilderDraftV2,
  gw: number,
  fromGw: number,
): DraftSlotState {
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

  return emptyDraftSlot();
}

function migrateV2ToV3(v2: SquadBuilderDraftV2, fromGw: number): SquadBuilderDraftV3 {
  const drafts: Record<string, DraftSlotState> = {};
  for (let i = 1; i <= SQUAD_BUILDER_DRAFT_COUNT; i++) {
    const gw = fromGw + i - 1;
    const direct = v2.squads[String(gw)];
    if (direct) {
      drafts[String(i)] = {
        picks: clonePicks(normalizeEmptySquadFormation(direct.picks)),
        captainId: direct.captainId,
        viceId: direct.viceId,
      };
      continue;
    }
    const resolved = resolveGwSquadV2(v2, gw, fromGw);
    drafts[String(i)] =
      filledPicks(resolved.picks).length > 0 ? resolved : emptyDraftSlot();
  }

  const activeDraft = Math.min(
    SQUAD_BUILDER_DRAFT_COUNT,
    Math.max(1, v2.planningGw - fromGw + 1),
  );

  return {
    version: 3,
    activeDraft,
    horizon: v2.horizon,
    drafts,
  };
}

export function clampDraftIndex(index: number): number {
  return Math.min(SQUAD_BUILDER_DRAFT_COUNT, Math.max(1, Math.floor(index) || 1));
}

export function draftSlotRange(): number[] {
  return Array.from({ length: SQUAD_BUILDER_DRAFT_COUNT }, (_, i) => i + 1);
}

export function saveDraftV2(draft: SquadBuilderDraftV3) {
  try {
    localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

/** Load saved drafts or create five empty comparison slots (migrates v2/v1). */
export function loadOrCreateDraft(
  fromGw: number,
  horizon: number,
): SquadBuilderDraftV3 {
  const existingV3 = loadV3();
  if (existingV3) {
    return {
      ...existingV3,
      activeDraft: clampDraftIndex(existingV3.activeDraft),
      horizon,
    };
  }

  const existingV2 = loadV2();
  if (existingV2) {
    return migrateV2ToV3(existingV2, fromGw);
  }

  const migrated = loadV1();
  const picks = migrated ?? createEmptySquad();
  return {
    version: 3,
    activeDraft: 1,
    horizon,
    drafts: {
      "1": {
        picks: clonePicks(picks),
        captainId: null,
        viceId: null,
      },
      "2": emptyDraftSlot(),
      "3": emptyDraftSlot(),
      "4": emptyDraftSlot(),
      "5": emptyDraftSlot(),
    },
  };
}

export function resolveDraftSlot(
  draft: SquadBuilderDraftV3,
  draftIndex: number,
): DraftSlotState {
  const hit = draft.drafts[String(clampDraftIndex(draftIndex))];
  if (hit) {
    return {
      picks: clonePicks(normalizeEmptySquadFormation(hit.picks)),
      captainId: hit.captainId,
      viceId: hit.viceId,
    };
  }
  return emptyDraftSlot();
}

export function upsertDraftSlot(
  draft: SquadBuilderDraftV3,
  draftIndex: number,
  state: DraftSlotState,
): SquadBuilderDraftV3 {
  const key = String(clampDraftIndex(draftIndex));
  return {
    ...draft,
    drafts: {
      ...draft.drafts,
      [key]: {
        picks: clonePicks(state.picks),
        captainId: state.captainId,
        viceId: state.viceId,
      },
    },
  };
}

/** Horizon xPt total for a draft when projections exist (null if incomplete). */
export function draftHorizonXpt(
  draft: SquadBuilderDraftV3,
  draftIndex: number,
  projById: Record<string, { by_gw?: { gw: number; xp: number }[] }>,
  fromGw: number,
  toGw: number,
): number | null {
  const slot = resolveDraftSlot(draft, draftIndex);
  const filled = filledPicks(slot.picks);
  if (filled.length !== 15) return null;

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
