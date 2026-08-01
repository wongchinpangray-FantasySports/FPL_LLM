import { normalizeLatinSearchText } from "@/lib/fpl/player-search";

/** Stable key for “same real player” — used when stale `players_static` rows share a name/club. */
export function miniPlayerIdentityKey(p: {
  fpl_id: number;
  web_name?: string | null;
  team_id?: number | null;
}): string {
  const name = normalizeLatinSearchText(p.web_name ?? "");
  const team = p.team_id ?? 0;
  if (!name) return `id:${p.fpl_id}`;
  return `${name}|${team}`;
}

export function hasDuplicateMiniPlayerIdentity(
  picks: Array<{
    fpl_id: number;
    web_name?: string | null;
    team_id?: number | null;
  }>,
): boolean {
  const keys = picks.map((p) => miniPlayerIdentityKey(p));
  return new Set(keys).size !== keys.length;
}
