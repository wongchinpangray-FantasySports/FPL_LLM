import type { WcPlayer } from "@/lib/wc/types";

export type FplSeasonProfile = {
  fpl_id: number;
  web_name: string | null;
  full_name: string | null;
  position: string;
  club_name: string;
  team_short: string | null;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
  form: number;
  minutes: number;
};

export type FplPlayerIndex = {
  byFplId: Map<number, FplSeasonProfile>;
};

/** O(1) name lookups — avoids scanning all FPL players per WC row (Worker CPU timeout). */
export type FplNameIndexes = {
  byFplId: Map<number, FplSeasonProfile>;
  byNormPos: Map<string, FplSeasonProfile>;
  byLastPos: Map<string, FplSeasonProfile[]>;
};

export function buildFplNameIndexes(index: FplPlayerIndex): FplNameIndexes {
  const byNormPos = new Map<string, FplSeasonProfile>();
  const byLastPos = new Map<string, FplSeasonProfile[]>();

  for (const p of index.byFplId.values()) {
    const labels = [p.full_name, p.web_name].filter(Boolean) as string[];
    for (const label of labels) {
      byNormPos.set(`${normName(label)}|${p.position}`, p);
      const lk = `${normName(lastName(label))}|${p.position}`;
      const list = byLastPos.get(lk) ?? [];
      if (!list.includes(p)) list.push(p);
      byLastPos.set(lk, list);
    }
  }

  return { byFplId: index.byFplId, byNormPos, byLastPos };
}

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : name;
}

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

type FplRow = {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  position: string | null;
  goals_scored: unknown;
  assists: unknown;
  expected_goals: unknown;
  expected_assists: unknown;
  form: unknown;
  minutes: unknown;
};

export function buildFplPlayerIndex(
  rows: FplRow[],
  clubNameByFplId: Map<number, string>,
  teamShortByFplId: Map<number, string>,
): FplPlayerIndex {
  const byFplId = new Map<number, FplSeasonProfile>();

  for (const r of rows) {
    const fplId = r.fpl_id;
    const club = clubNameByFplId.get(fplId) ?? "";
    if (!club) continue;

    byFplId.set(fplId, {
      fpl_id: fplId,
      web_name: r.web_name,
      full_name: r.name,
      position: (r.position as string) ?? "",
      club_name: club,
      team_short: teamShortByFplId.get(fplId) ?? r.team ?? null,
      goals: num(r.goals_scored),
      assists: num(r.assists),
      xg: num(r.expected_goals),
      xa: num(r.expected_assists),
      form: num(r.form),
      minutes: num(r.minutes),
    });
  }

  return { byFplId };
}

function pickUnique(
  list: FplSeasonProfile[] | undefined,
): FplSeasonProfile | null {
  if (!list || list.length !== 1) return null;
  return list[0]!;
}

/** Resolve a WC player to their FPL / Premier League season club (if any). */
export function resolveFplSeasonProfile(
  player: WcPlayer,
  indexes: FplNameIndexes,
): FplSeasonProfile | null {
  if (player.fpl_id != null) {
    return indexes.byFplId.get(player.fpl_id) ?? null;
  }

  const wcNorm = normName(player.name);
  const pos = player.position;

  const fullHit = indexes.byNormPos.get(`${wcNorm}|${pos}`);
  if (fullHit) return fullHit;

  const wcLast = normName(lastName(player.name));
  const lastHit = pickUnique(indexes.byLastPos.get(`${wcLast}|${pos}`));
  if (lastHit) return lastHit;

  for (const p of indexes.byLastPos.get(`${wcLast}|${pos}`) ?? []) {
    if (p.web_name && wcNorm.includes(normName(p.web_name))) return p;
  }

  for (const [key, p] of indexes.byNormPos) {
    if (!key.endsWith(`|${pos}`)) continue;
    const web = p.web_name;
    if (web && normName(web).length >= 4 && wcNorm.includes(normName(web))) return p;
  }

  return null;
}

/** Any FPL `players_static` row is a Premier League club player. */
export function isPremierLeagueSeasonProfile(
  profile: FplSeasonProfile | null | undefined,
): boolean {
  return profile != null && profile.club_name.length > 0;
}
