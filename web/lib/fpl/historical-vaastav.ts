import { fplTeamShortByCode, fplTeamShortLabel, fplTeamFullName } from "./fpl-team-codes";

const VAASTAV_BASE =
  "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data";

const VAASTAV_SEASON_FOLDERS = [
  "2016-17",
  "2017-18",
  "2018-19",
  "2019-20",
  "2020-21",
  "2021-22",
  "2022-23",
  "2023-24",
  "2024-25",
  "2025-26",
] as const;

type FixtureSide = { opponentId: number; wasHome: boolean };

export type { FixtureSide };

const csvCache = new Map<string, Record<string, string>[]>();
const teamMapCache = new Map<string, Map<number, string>>();
const playerTeamIdCache = new Map<string, Map<number, number>>();

export function seasonToVaastavFolder(season: string): string {
  const y = Number(season);
  if (!Number.isFinite(y)) return season;
  return `${season}-${String(y + 1).slice(-2)}`;
}

/** End-of-season FPL totals keyed by stable element `code` (vaastav players_raw). */
export async function loadVaastavSeasonTotalsByCode(
  seasonKey: string,
): Promise<Map<number, number>> {
  const folder = seasonToVaastavFolder(seasonKey);
  if (
    !VAASTAV_SEASON_FOLDERS.includes(
      folder as (typeof VAASTAV_SEASON_FOLDERS)[number],
    )
  ) {
    return new Map();
  }

  const rows = await loadCsv(`${folder}/players_raw.csv`);
  const out = new Map<number, number>();
  for (const row of rows) {
    const code = Number(row.code);
    const pts = Number(row.total_points);
    if (!Number.isFinite(code) || code <= 0 || !Number.isFinite(pts)) continue;
    out.set(code, Math.round(pts));
  }
  return out;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]!);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

async function fetchVaastavCsv(relativePath: string): Promise<string | null> {
  const url = `${VAASTAV_BASE}/${relativePath}`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

async function loadCsv(relativePath: string): Promise<Record<string, string>[]> {
  const cached = csvCache.get(relativePath);
  if (cached) return cached;
  const text = await fetchVaastavCsv(relativePath);
  const rows = text ? parseCsv(text) : [];
  csvCache.set(relativePath, rows);
  return rows;
}

function shortCode(raw: string): string {
  const s = raw.trim();
  if (!s) return "—";
  if (s.length <= 4 && s === s.toUpperCase()) return s;
  const parts = s.split(/\s+/);
  if (parts.length === 1) return s.slice(0, 3).toUpperCase();
  return parts
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

let fplTeamCodeMapPromise: Promise<Map<string, string>> | null = null;

async function loadFplTeamCodeMap(): Promise<Map<string, string>> {
  if (!fplTeamCodeMapPromise) {
    fplTeamCodeMapPromise = (async () => {
      const out = new Map<string, string>();
      for (const [code, label] of Object.entries(fplTeamShortByCode())) {
        out.set(code, label);
      }
      for (const folder of VAASTAV_SEASON_FOLDERS) {
        const teamRows = await loadCsv(`${folder}/teams.csv`);
        for (const row of teamRows) {
          const code = (row.code || "").trim();
          const label = (row.short_name || row.name || "").trim();
          if (code && label) out.set(code, shortCode(label));
        }
      }
      const bootstrap = await loadBootstrapTeamCodeMap();
      for (const [code, label] of bootstrap) {
        if (!out.has(code)) out.set(code, label);
      }
      return out;
    })();
  }
  return fplTeamCodeMapPromise;
}

function codeToLabel(
  codeMap: Map<string, string>,
  code: string,
): string | undefined {
  const c = code.trim();
  if (!c) return undefined;
  return codeMap.get(c) ?? fplTeamShortLabel(c);
}

export async function loadSeasonTeamIdMap(
  season: string,
): Promise<Map<number, string>> {
  const cached = teamMapCache.get(season);
  if (cached) return cached;

  const folder = seasonToVaastavFolder(season);
  const map = new Map<number, string>();
  const codeMap = await loadFplTeamCodeMap();

  const teamRows = await loadCsv(`${folder}/teams.csv`);
  for (const row of teamRows) {
    const id = Number(row.id);
    const label = (row.short_name || row.name || "").trim();
    if (id > 0 && label) map.set(id, shortCode(label));
  }

  const playerRows = await loadCsv(`${folder}/players_raw.csv`);
  const teamIdToCode = new Map<number, string>();
  for (const row of playerRows) {
    const teamId = Number(row.team);
    const code = (row.team_code || "").trim();
    if (teamId > 0 && code && !teamIdToCode.has(teamId)) {
      teamIdToCode.set(teamId, code);
    }
  }

  for (const [teamId, code] of teamIdToCode) {
    if (map.has(teamId)) continue;
    const label = codeToLabel(codeMap, code);
    if (label) map.set(teamId, label);
  }

  teamMapCache.set(season, map);
  return map;
}

let bootstrapCodePromise: Promise<Map<string, string>> | null = null;

async function loadBootstrapTeamCodeMap(): Promise<Map<string, string>> {
  if (!bootstrapCodePromise) {
    bootstrapCodePromise = (async () => {
      const out = new Map<string, string>();
      try {
        const res = await fetch(
          "https://fantasy.premierleague.com/api/bootstrap-static/",
          { next: { revalidate: 86400 } },
        );
        if (!res.ok) return out;
        const data = (await res.json()) as {
          teams?: { code?: number; short_name?: string }[];
        };
        for (const t of data.teams ?? []) {
          const code = String(t.code ?? "");
          const short = (t.short_name || "").trim().toUpperCase();
          if (code && short) out.set(code, short);
        }
      } catch {
        /* ignore */
      }
      return out;
    })();
  }
  return bootstrapCodePromise;
}

export async function loadPlayerTeamIdForSeason(
  season: string,
  fplId: number,
): Promise<number | null> {
  const map = await loadPlayerTeamIdMapForSeason(season);
  return map.get(fplId) ?? null;
}

async function loadPlayerTeamIdMapForSeason(
  season: string,
): Promise<Map<number, number>> {
  const cached = playerTeamIdCache.get(season);
  if (cached) return cached;

  const folder = seasonToVaastavFolder(season);
  const map = new Map<number, number>();
  const rows = await loadCsv(`${folder}/players_raw.csv`);
  for (const row of rows) {
    const id = Number(row.id);
    const teamId = Number(row.team);
    if (id > 0 && teamId > 0) map.set(id, teamId);
  }
  playerTeamIdCache.set(season, map);
  return map;
}

function parseGwNumber(row: Record<string, string>): number {
  return Number(row.GW || row.round || row.event || 0);
}

function parseWasHome(row: Record<string, string>): boolean {
  return String(row.was_home ?? "").toLowerCase() === "true";
}

function fixtureSideKey(side: FixtureSide): string {
  return `${side.opponentId}:${side.wasHome}`;
}

function mergeFixtureSideLists(
  ...lists: FixtureSide[][]
): FixtureSide[] {
  const out: FixtureSide[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const side of list) {
      if (side.opponentId <= 0) continue;
      const key = fixtureSideKey(side);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(side);
    }
  }
  return out;
}

export function mergeFixtureMaps(
  ...maps: Map<number, FixtureSide[]>[]
): Map<number, FixtureSide[]> {
  const out = new Map<number, FixtureSide[]>();
  for (const map of maps) {
    for (const [gw, sides] of map) {
      if (!gw) continue;
      out.set(gw, mergeFixtureSideLists(out.get(gw) ?? [], sides));
    }
  }
  return out;
}

async function loadTeamFixturesFromFixturesCsv(
  season: string,
  teamId: number,
): Promise<Map<number, FixtureSide[]>> {
  const folder = seasonToVaastavFolder(season);
  const rows = await loadCsv(`${folder}/fixtures.csv`);
  const map = new Map<number, FixtureSide[]>();
  if (!rows.length) return map;

  for (const row of rows) {
    const gw = Number(row.event);
    const home = Number(row.team_h);
    const away = Number(row.team_a);
    if (!gw || !home || !away) continue;

    if (home === teamId) {
      const list = map.get(gw) ?? [];
      list.push({ opponentId: away, wasHome: true });
      map.set(gw, list);
    } else if (away === teamId) {
      const list = map.get(gw) ?? [];
      list.push({ opponentId: home, wasHome: false });
      map.set(gw, list);
    }
  }
  return map;
}

async function loadTeamFixturesFromMergedGw(
  season: string,
  teamId: number,
): Promise<Map<number, FixtureSide[]>> {
  const folder = seasonToVaastavFolder(season);
  const [merged, playerTeams] = await Promise.all([
    loadCsv(`${folder}/gws/merged_gw.csv`),
    loadPlayerTeamIdMapForSeason(season),
  ]);
  const map = new Map<number, FixtureSide[]>();
  if (!merged.length) return map;

  const seenByGw = new Map<number, Set<string>>();
  for (const row of merged) {
    const playerId = Number(row.element);
    const gw = parseGwNumber(row);
    const opponentId = Number(row.opponent_team);
    if (!playerId || !gw || !opponentId) continue;

    const rowTeamId = Number(row.team);
    const playerTeamId = playerTeams.get(playerId);
    const effectiveTeamId =
      rowTeamId > 0 ? rowTeamId : (playerTeamId ?? 0);
    if (effectiveTeamId !== teamId) continue;

    const side: FixtureSide = {
      opponentId,
      wasHome: parseWasHome(row),
    };
    const fixtureKey =
      (row.fixture || "").trim() || fixtureSideKey(side);
    const gwSeen = seenByGw.get(gw) ?? new Set<string>();
    if (gwSeen.has(fixtureKey)) continue;
    gwSeen.add(fixtureKey);
    seenByGw.set(gw, gwSeen);

    const list = map.get(gw) ?? [];
    list.push(side);
    map.set(gw, list);
  }
  return map;
}

/** Per-player opponents from vaastav merged_gw (captures DGW fixture pairs). */
export async function loadPlayerFixturesByGw(
  season: string,
  fplId: number,
): Promise<Map<number, FixtureSide[]>> {
  const folder = seasonToVaastavFolder(season);
  const merged = await loadCsv(`${folder}/gws/merged_gw.csv`);
  const map = new Map<number, FixtureSide[]>();
  if (!merged.length) return map;

  const seenByGw = new Map<number, Set<string>>();
  for (const row of merged) {
    if (Number(row.element) !== fplId) continue;
    const gw = parseGwNumber(row);
    const opponentId = Number(row.opponent_team);
    if (!gw || !opponentId) continue;

    const side: FixtureSide = {
      opponentId,
      wasHome: parseWasHome(row),
    };
    const fixtureKey =
      (row.fixture || "").trim() || fixtureSideKey(side);
    const gwSeen = seenByGw.get(gw) ?? new Set<string>();
    if (gwSeen.has(fixtureKey)) continue;
    gwSeen.add(fixtureKey);
    seenByGw.set(gw, gwSeen);

    const list = map.get(gw) ?? [];
    list.push(side);
    map.set(gw, list);
  }
  return map;
}

export async function loadTeamFixturesByGw(
  season: string,
  teamId: number,
): Promise<Map<number, FixtureSide[]>> {
  const [fromCsv, fromMerged] = await Promise.all([
    loadTeamFixturesFromFixturesCsv(season, teamId),
    loadTeamFixturesFromMergedGw(season, teamId),
  ]);
  return mergeFixtureMaps(fromCsv, fromMerged);
}

export function opponentLabel(
  teamMap: Map<number, string>,
  opponentId: number | null | undefined,
  wasHome: boolean | null | undefined,
): string {
  if (opponentId == null || opponentId <= 0) return "—";
  const code = teamMap.get(opponentId) ?? `#${opponentId}`;
  if (wasHome == null) return code;
  return `${code} (${wasHome ? "H" : "A"})`;
}

export function formatOpponents(
  teamMap: Map<number, string>,
  sides: FixtureSide[],
): string {
  if (!sides.length) return "—";
  return sides
    .map((s) => opponentLabel(teamMap, s.opponentId, s.wasHome))
    .join(" · ");
}

const VAASTAV_POSITION: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

/** Archived squad list when DB profiles are missing (team ids are season-specific). */
export async function loadVaastavPlayerSummariesForTeamIds(
  season: string,
  teamIds: number[],
): Promise<
  Array<{
    fpl_id: number;
    web_name: string;
    name: string;
    team: string;
    position: string;
  }>
> {
  if (!teamIds.length) return [];

  const folder = seasonToVaastavFolder(season);
  if (
    !VAASTAV_SEASON_FOLDERS.includes(
      folder as (typeof VAASTAV_SEASON_FOLDERS)[number],
    )
  ) {
    return [];
  }

  const allowed = new Set(teamIds);
  const teamMap = await loadSeasonTeamIdMap(season);
  const rows = await loadCsv(`${folder}/players_raw.csv`);
  const out: Array<{
    fpl_id: number;
    web_name: string;
    name: string;
    team: string;
    position: string;
  }> = [];

  for (const row of rows) {
    const teamId = Number(row.team);
    const id = Number(row.id);
    if (!Number.isFinite(id) || id <= 0 || !allowed.has(teamId)) continue;

    const first = String(row.first_name ?? "").trim();
    const second = String(row.second_name ?? "").trim();
    const fullName = `${first} ${second}`.trim();
    const webName = String(row.web_name ?? "").trim() || fullName;
    const pos = VAASTAV_POSITION[Number(row.element_type)] ?? "";
    const code = String(row.team_code ?? "").trim();
    const teamLabel =
      fplTeamFullName(code) ??
      teamMap.get(teamId) ??
      shortCode(String(row.short_name ?? ""));

    out.push({
      fpl_id: id,
      web_name: webName,
      name: fullName || webName,
      team: teamLabel,
      position: pos,
    });
  }

  return out;
}
