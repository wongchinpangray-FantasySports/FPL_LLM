import { fifaTeamToWcCode } from "@/lib/wc/fifa-teams";

const FIFA_JSON_BASE = "https://play.fifa.com/json/fantasy";

const FIFA_HEADERS = {
  Accept: "application/json",
  Origin: "https://fantasy.fifa.com",
  Referer: "https://fantasy.fifa.com/",
};

const CACHE_MS = 15 * 60 * 1000;

export type FifaSquadRow = {
  id: number;
  name: string;
  group: string;
  abbr: string;
  isEliminated: boolean;
};

export type FifaPlayerProfile = {
  id: number;
  name: string;
  position: string;
  squadId: number;
  totalPoints: number | null;
  roundPoints: Record<string, number>;
  form: number | null;
  percentSelected: number | null;
};

let squadsCache: FifaSquadRow[] | null = null;
let squadsCacheAt = 0;

let playerProfileCache: Map<number, FifaPlayerProfile> | null = null;
let playerProfileCacheAt = 0;

function playerName(row: {
  firstName?: string;
  lastName?: string;
  knownName?: string | null;
}): string {
  return (
    row.knownName?.trim() ||
    `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim()
  );
}

export async function loadFifaSquads(): Promise<FifaSquadRow[]> {
  if (squadsCache && Date.now() - squadsCacheAt < CACHE_MS) {
    return squadsCache;
  }

  const res = await fetch(`${FIFA_JSON_BASE}/squads.json`, {
    headers: FIFA_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) return squadsCache ?? [];

  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : [];
  const rows: FifaSquadRow[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const id = Number(s.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    rows.push({
      id,
      name: String(s.name ?? ""),
      group: String(s.group ?? "").toUpperCase(),
      abbr: String(s.abbr ?? ""),
      isEliminated: Boolean(s.isEliminated),
    });
  }

  squadsCache = rows;
  squadsCacheAt = Date.now();
  return rows;
}

export function squadCodeToGroup(
  squads: FifaSquadRow[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of squads) {
    const code =
      fifaTeamToWcCode({ short_name: s.abbr, name: s.name }) ??
      s.abbr.toUpperCase();
    if (code) map.set(code, s.group);
  }
  return map;
}

export async function loadFifaPlayerProfiles(): Promise<
  Map<number, FifaPlayerProfile>
> {
  if (playerProfileCache && Date.now() - playerProfileCacheAt < CACHE_MS) {
    return playerProfileCache;
  }

  const res = await fetch(`${FIFA_JSON_BASE}/players.json`, {
    headers: FIFA_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) return playerProfileCache ?? new Map();

  const raw = await res.json();
  const list = Array.isArray(raw)
    ? raw
    : ((raw as { players?: unknown[] }).players ?? []);

  const map = new Map<number, FifaPlayerProfile>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const id = Number(p.id);
    if (!Number.isFinite(id) || id <= 0) continue;

    const stats = (p.stats as Record<string, unknown> | undefined) ?? {};
    const roundRaw = stats.roundPoints;
    const roundPoints: Record<string, number> = {};
    if (roundRaw && typeof roundRaw === "object") {
      for (const [k, v] of Object.entries(roundRaw as Record<string, unknown>)) {
        const n = Number(v);
        if (Number.isFinite(n)) roundPoints[k] = n;
      }
    }

    const name = playerName(
      p as {
        firstName?: string;
        lastName?: string;
        knownName?: string | null;
      },
    );
    if (!name) continue;

    map.set(id, {
      id,
      name,
      position: String(p.position ?? ""),
      squadId: Number(p.squadId ?? 0),
      totalPoints:
        stats.totalPoints != null ? Number(stats.totalPoints) : null,
      roundPoints,
      form: stats.form != null ? Number(stats.form) : null,
      percentSelected:
        p.percentSelected != null ? Number(p.percentSelected) : null,
    });
  }

  playerProfileCache = map;
  playerProfileCacheAt = Date.now();
  return map;
}
