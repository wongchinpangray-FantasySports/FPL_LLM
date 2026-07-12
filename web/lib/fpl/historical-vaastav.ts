import { fplTeamShortByCode, fplTeamShortLabel } from "./fpl-team-codes";

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
] as const;

type FixtureSide = { opponentId: number; wasHome: boolean };

const csvCache = new Map<string, Record<string, string>[]>();
const teamMapCache = new Map<string, Map<number, string>>();

export function seasonToVaastavFolder(season: string): string {
  const y = Number(season);
  if (!Number.isFinite(y)) return season;
  return `${season}-${String(y + 1).slice(-2)}`;
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
  const folder = seasonToVaastavFolder(season);
  const rows = await loadCsv(`${folder}/players_raw.csv`);
  for (const row of rows) {
    if (Number(row.id) === fplId) {
      const teamId = Number(row.team);
      return teamId > 0 ? teamId : null;
    }
  }
  return null;
}

export async function loadTeamFixturesByGw(
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
