/** Keep one row per FPL element id (first occurrence wins). */
export function dedupeRowsByFplId<T extends { fpl_id: number }>(rows: T[]): T[] {
  const byId = new Map<number, T>();
  for (const row of rows) {
    if (!byId.has(row.fpl_id)) byId.set(row.fpl_id, row);
  }
  return [...byId.values()];
}

export function hasDuplicateFplIds(rows: { fpl_id: number }[]): boolean {
  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.fpl_id)) return true;
    seen.add(row.fpl_id);
  }
  return false;
}
