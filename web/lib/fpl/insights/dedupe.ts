import { miniPlayerIdentityKey } from "@/lib/mini/player-identity";
import { fetchOfficialFplPlayers } from "@/lib/squad-builder/fpl-live-players";

export type InsightPlayerRow = {
  fpl_id: number;
  web_name?: string | null;
  team_id?: number | null;
};

/** Current-season FPL element ids from bootstrap-static. */
export async function loadOfficialFplPlayerIdSet(): Promise<Set<number>> {
  const players = await fetchOfficialFplPlayers();
  return new Set(players.map((p) => p.fpl_id));
}

/** Keep one row per FPL element id (first occurrence wins). */
export function dedupeRowsByFplId<T extends { fpl_id: number }>(rows: T[]): T[] {
  const byId = new Map<number, T>();
  for (const row of rows) {
    if (!byId.has(row.fpl_id)) byId.set(row.fpl_id, row);
  }
  return [...byId.values()];
}

/** Collapse stale duplicate `players_static` rows for the same name/club. */
export function dedupeRowsByPlayerIdentity<T extends InsightPlayerRow>(
  rows: T[],
  merge?: (prev: T, next: T) => T,
): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = miniPlayerIdentityKey(row);
    const prev = best.get(key);
    if (!prev) {
      best.set(key, row);
      continue;
    }
    best.set(key, merge ? merge(prev, row) : row.fpl_id > prev.fpl_id ? row : prev);
  }
  return [...best.values()];
}

/** Drop stale rows and collapse duplicate names for Insights player tables. */
export function normalizeInsightPlayerRows<T extends InsightPlayerRow>(
  rows: T[],
  officialIds: Set<number>,
  merge?: (prev: T, next: T) => T,
): T[] {
  const current = rows.filter((row) => officialIds.has(row.fpl_id));
  return dedupeRowsByPlayerIdentity(dedupeRowsByFplId(current), merge);
}

export function hasDuplicateFplIds(rows: { fpl_id: number }[]): boolean {
  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.fpl_id)) return true;
    seen.add(row.fpl_id);
  }
  return false;
}

export function hasDuplicatePlayerIdentity(
  rows: Parameters<typeof miniPlayerIdentityKey>[0][],
): boolean {
  const keys = rows.map((row) => miniPlayerIdentityKey(row));
  return new Set(keys).size !== keys.length;
}
