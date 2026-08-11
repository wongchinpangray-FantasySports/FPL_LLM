import {
  fetchOfficialFplPlayers,
  type FplLiveBrowsePlayer,
} from "@/lib/squad-builder/fpl-live-players";
import { validateMiniSquad } from "@/lib/mini/validate";

export type MiniTemplateId = "safe" | "differential" | "budget";

export interface MiniTemplateSquad {
  id: MiniTemplateId;
  titleKey: string;
  bodyKey: string;
  pick_ids: number[];
  captain_fpl_id: number;
  vice_fpl_id: number;
  players: FplLiveBrowsePlayer[];
}

function byPos(pool: FplLiveBrowsePlayer[], pos: string) {
  return pool.filter((p) => p.position === pos);
}

function tryBuild(
  id: MiniTemplateId,
  titleKey: string,
  bodyKey: string,
  candidates: FplLiveBrowsePlayer[],
  captainIdx: number,
  viceIdx: number,
): MiniTemplateSquad | null {
  if (candidates.length !== 5) return null;
  const inputs = candidates.map((p) => ({
    fpl_id: p.fpl_id,
    position: p.position,
    team_id: p.team_id,
    web_name: p.web_name,
  }));
  if (validateMiniSquad(inputs).length > 0) return null;
  const captain = candidates[captainIdx]!;
  const vice = candidates[viceIdx]!;
  if (captain.fpl_id === vice.fpl_id) return null;
  return {
    id,
    titleKey,
    bodyKey,
    pick_ids: candidates.map((p) => p.fpl_id),
    captain_fpl_id: captain.fpl_id,
    vice_fpl_id: vice.fpl_id,
    players: candidates,
  };
}

function pickUnique(
  lists: FplLiveBrowsePlayer[][],
): FplLiveBrowsePlayer[] | null {
  const used = new Set<number>();
  const usedTeams = new Map<number, number>();
  const out: FplLiveBrowsePlayer[] = [];
  for (const list of lists) {
    const hit = list.find((p) => {
      if (used.has(p.fpl_id)) return false;
      const tid = p.team_id;
      if (tid != null && (usedTeams.get(tid) ?? 0) >= 2) return false;
      return true;
    });
    if (!hit) return null;
    used.add(hit.fpl_id);
    if (hit.team_id != null) {
      usedTeams.set(hit.team_id, (usedTeams.get(hit.team_id) ?? 0) + 1);
    }
    out.push(hit);
  }
  return out;
}

/** Build three starter templates from the live FPL player pool. */
export async function buildMiniTemplates(): Promise<MiniTemplateSquad[]> {
  const available = await fetchOfficialFplPlayers();

  const gkOwn = [...byPos(available, "GKP")].sort(
    (a, b) => (b.selected_by_percent ?? 0) - (a.selected_by_percent ?? 0),
  );
  const defOwn = [...byPos(available, "DEF")].sort(
    (a, b) => (b.selected_by_percent ?? 0) - (a.selected_by_percent ?? 0),
  );
  const midOwn = [...byPos(available, "MID")].sort(
    (a, b) => (b.selected_by_percent ?? 0) - (a.selected_by_percent ?? 0),
  );
  const fwdOwn = [...byPos(available, "FWD")].sort(
    (a, b) => (b.selected_by_percent ?? 0) - (a.selected_by_percent ?? 0),
  );

  const midForm = [...byPos(available, "MID")].sort(
    (a, b) =>
      (b.form ?? 0) - (a.form ?? 0) ||
      (a.selected_by_percent ?? 99) - (b.selected_by_percent ?? 99),
  );
  const fwdForm = [...byPos(available, "FWD")].sort(
    (a, b) =>
      (b.form ?? 0) - (a.form ?? 0) ||
      (a.selected_by_percent ?? 99) - (b.selected_by_percent ?? 99),
  );
  const defForm = [...byPos(available, "DEF")].sort(
    (a, b) =>
      (b.form ?? 0) - (a.form ?? 0) ||
      (a.selected_by_percent ?? 99) - (b.selected_by_percent ?? 99),
  );

  const gkCheap = [...byPos(available, "GKP")].sort(
    (a, b) => (a.base_price ?? 99) - (b.base_price ?? 99),
  );
  const defCheap = [...byPos(available, "DEF")].sort(
    (a, b) => (a.base_price ?? 99) - (b.base_price ?? 99),
  );
  const midCheap = [...byPos(available, "MID")].sort(
    (a, b) => (a.base_price ?? 99) - (b.base_price ?? 99),
  );
  const fwdCheap = [...byPos(available, "FWD")].sort(
    (a, b) => (a.base_price ?? 99) - (b.base_price ?? 99),
  );

  const templates: MiniTemplateSquad[] = [];

  const safe = pickUnique([gkOwn, defOwn, midOwn, midOwn.slice(1), fwdOwn]);
  if (safe) {
    const t = tryBuild("safe", "templateSafeTitle", "templateSafeBody", safe, 2, 4);
    if (t) templates.push(t);
  }

  const differential = pickUnique([
    gkOwn.slice(3),
    defForm.filter((p) => (p.selected_by_percent ?? 0) < 20),
    midForm.filter((p) => (p.selected_by_percent ?? 0) < 20),
    midForm.filter((p) => (p.selected_by_percent ?? 0) < 25),
    fwdForm.filter((p) => (p.selected_by_percent ?? 0) < 25),
  ]);
  if (differential) {
    const t = tryBuild(
      "differential",
      "templateDiffTitle",
      "templateDiffBody",
      differential,
      2,
      4,
    );
    if (t) templates.push(t);
  }

  const budget = pickUnique([
    gkCheap,
    defCheap,
    defCheap.slice(1),
    midCheap,
    fwdCheap,
  ]);
  if (budget) {
    const t = tryBuild(
      "budget",
      "templateBudgetTitle",
      "templateBudgetBody",
      budget,
      3,
      4,
    );
    if (t) templates.push(t);
  }

  return templates;
}
