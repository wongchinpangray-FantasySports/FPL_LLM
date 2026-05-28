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

function uniqueByPosition(
  entries: FplSeasonProfile[],
  position: string,
): FplSeasonProfile | null {
  const same = entries.filter((e) => e.position === position);
  if (same.length === 1) return same[0]!;
  return null;
}

/** Resolve a WC player to their FPL / Premier League season club (if any). */
export function resolveFplSeasonProfile(
  player: WcPlayer,
  index: FplPlayerIndex,
): FplSeasonProfile | null {
  if (player.fpl_id != null) {
    return index.byFplId.get(player.fpl_id) ?? null;
  }

  const profiles = [...index.byFplId.values()];
  const wcNorm = normName(player.name);
  const wcLast = normName(lastName(player.name));

  const byFull = profiles.filter((p) => {
    const labels = [p.full_name, p.web_name].filter(Boolean) as string[];
    return labels.some((l) => normName(l) === wcNorm);
  });
  const fullHit = uniqueByPosition(byFull, player.position);
  if (fullHit) return fullHit;

  const byLast = profiles.filter((p) => {
    const labels = [p.full_name, p.web_name].filter(Boolean) as string[];
    return labels.some((l) => normName(lastName(l)) === wcLast);
  });
  const lastHit = uniqueByPosition(byLast, player.position);
  if (lastHit) return lastHit;

  const byWeb = profiles.filter(
    (p) => p.web_name != null && wcNorm.includes(normName(p.web_name)),
  );
  const webHit = uniqueByPosition(byWeb, player.position);
  if (webHit) return webHit;

  const byWebInWc = profiles.filter(
    (p) => p.web_name != null && normName(p.web_name).length >= 4 && wcNorm.includes(normName(p.web_name)),
  );
  return uniqueByPosition(byWebInWc, player.position);
}

/** Any FPL `players_static` row is a Premier League club player. */
export function isPremierLeagueSeasonProfile(
  profile: FplSeasonProfile | null | undefined,
): boolean {
  return profile != null && profile.club_name.length > 0;
}
