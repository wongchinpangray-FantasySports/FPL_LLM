import type { PlannerPickPayload } from "@/components/planner/types";
import { createEmptySquad } from "@/lib/squad-builder/slots";
import type { FplLiveBrowsePlayer } from "@/lib/squad-builder/fpl-live-players";

/**
 * Place 15 FPL IDs into squad-builder slots (GKP×2, DEF×5, MID×5, FWD×3).
 * Prefers matching each id's known position; falls back to first empty same-pos slot.
 */
export function picksFromBrowsePlayers(
  ids: number[],
  byId: Map<number, FplLiveBrowsePlayer>,
  opts?: { captainId?: number | null; viceId?: number | null },
): PlannerPickPayload[] {
  const empty = createEmptySquad();
  const captainId = opts?.captainId ?? null;
  const viceId = opts?.viceId ?? null;

  const remaining = [...ids].filter((id) => id > 0);
  const used = new Set<number>();

  const takeForPos = (pos: string): FplLiveBrowsePlayer | null => {
    const idx = remaining.findIndex((id) => {
      if (used.has(id)) return false;
      const p = byId.get(id);
      return p?.position === pos;
    });
    if (idx < 0) return null;
    const id = remaining[idx]!;
    remaining.splice(idx, 1);
    used.add(id);
    return byId.get(id) ?? null;
  };

  return empty.map((slot) => {
    const pos = slot.position ?? "MID";
    const p = takeForPos(pos);
    if (!p) return slot;
    return {
      ...slot,
      fpl_id: p.fpl_id,
      web_name: p.web_name,
      team: p.team,
      team_id: p.team_id,
      position: p.position,
      base_price: p.base_price,
      is_starter: slot.is_starter,
      is_captain: p.fpl_id === captainId,
      is_vice_captain: p.fpl_id === viceId && p.fpl_id !== captainId,
    };
  });
}

export function parseSquadBuilderImportParams(sp: {
  ids?: string | string[];
  c?: string | string[];
  v?: string | string[];
  draft?: string | string[];
}): {
  ids: number[];
  captainId: number | null;
  viceId: number | null;
  draft: number;
} | null {
  const idsRaw = Array.isArray(sp.ids) ? sp.ids[0] : sp.ids;
  if (!idsRaw?.trim()) return null;
  const ids = idsRaw
    .split(/[, ]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length !== 15) return null;

  const cRaw = Array.isArray(sp.c) ? sp.c[0] : sp.c;
  const vRaw = Array.isArray(sp.v) ? sp.v[0] : sp.v;
  const dRaw = Array.isArray(sp.draft) ? sp.draft[0] : sp.draft;
  const captainId = cRaw ? Number(cRaw) : null;
  const viceId = vRaw ? Number(vRaw) : null;
  const draft = dRaw ? Math.min(5, Math.max(1, Number(dRaw) || 1)) : 1;

  return {
    ids,
    captainId:
      captainId && Number.isFinite(captainId) && captainId > 0
        ? captainId
        : null,
    viceId:
      viceId && Number.isFinite(viceId) && viceId > 0 ? viceId : null,
    draft,
  };
}
