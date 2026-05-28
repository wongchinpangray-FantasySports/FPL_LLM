import { fifaTeamToWcCode } from "@/lib/wc/fifa-teams";

export type FifaElement = {
  id: number;
  web_name?: string;
  first_name?: string;
  second_name?: string;
  team?: number;
  team_code?: string;
  element_type?: number;
  position_label?: string;
  now_cost?: number;
  form?: string | number;
  goals_scored?: number;
  assists?: number;
  expected_goals?: string | number;
  expected_assists?: string | number;
  minutes?: number;
  selection_pct?: number;
};

export type FifaBootstrap = {
  elements: FifaElement[];
  teams: { id: number; code?: number | string; name?: string; short_name?: string }[];
};

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function posFromLabel(label: string): number {
  const u = label.toUpperCase();
  if (u.includes("GK") || u === "G" || u === "1") return 1;
  if (u.includes("DEF") || u === "D" || u === "2") return 2;
  if (u.includes("MID") || u === "M" || u === "3") return 3;
  if (u.includes("FWD") || u.includes("FOR") || u === "F" || u === "4") return 4;
  return 3;
}

/** play.fifa.com/json/fantasy/squads.json nation row */
export function isFifaNationSquadRow(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return Boolean(r.abbr && r.name) && r.squadId == null && r.firstName == null;
}

function normalizePlayer(raw: Record<string, unknown>): FifaElement | null {
  const id = num(raw.id ?? raw.player_id ?? raw.element_id ?? raw.playerId);
  if (id <= 0) return null;

  const first = str(raw.firstName ?? raw.first_name);
  const last = str(raw.lastName ?? raw.last_name);
  const name =
    str(raw.knownName ?? raw.known_name) ||
    str(raw.web_name) ||
    str(raw.display_name) ||
    (first || last ? `${first} ${last}`.trim() : "") ||
    str(raw.name) ||
    str(raw.short_name);
  if (!name) return null;

  const country =
    str(raw.country) ||
    str(raw.nation) ||
    str(raw.team_code) ||
    str(raw.countryCode);
  const teamCode = country ? fifaTeamToWcCode({ short_name: country, name: country }) : null;

  const posLabel = str(raw.position ?? raw.pos ?? raw.role);
  const element_type =
    typeof raw.element_type === "number"
      ? raw.element_type
      : posFromLabel(posLabel);

  const stats =
    raw.stats && typeof raw.stats === "object"
      ? (raw.stats as Record<string, unknown>)
      : null;
  const price = num(raw.price ?? raw.now_cost);

  return {
    id,
    web_name: name,
    first_name: first || undefined,
    second_name: last || undefined,
    team: num(raw.squadId ?? raw.squad_id ?? raw.team ?? raw.team_id),
    team_code: teamCode ?? undefined,
    element_type,
    position_label: posLabel || undefined,
    now_cost: price > 0 && price < 20 ? price * 10 : price,
    form: num(stats?.form ?? raw.form),
    goals_scored: num(stats?.goals ?? raw.goals_scored),
    assists: num(stats?.assists ?? raw.assists),
    expected_goals: (raw.expected_goals ?? raw.xg) as string | number | undefined,
    expected_assists: (raw.expected_assists ?? raw.xa) as string | number | undefined,
    minutes: num(raw.minutes),
    selection_pct: num(raw.percentSelected ?? raw.selection_pct),
  };
}

function normalizeTeam(raw: Record<string, unknown>): FifaBootstrap["teams"][0] | null {
  const id = num(raw.id ?? raw.team_id ?? raw.squad_id);
  if (id <= 0) return null;
  const abbr = str(raw.abbr ?? raw.short_name ?? raw.code);
  return {
    id,
    code: abbr || undefined,
    name: str(raw.name) || str(raw.team_name) || undefined,
    short_name: abbr || undefined,
  };
}

/** `squads.json` — list of nations (id, name, abbr). */
export function parseFifaSquadsTeams(raw: unknown): FifaBootstrap["teams"] {
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { squads?: unknown }).squads)
      ? (raw as { squads: unknown[] }).squads
      : null;
  if (!arr) return [];

  return arr
    .filter(isFifaNationSquadRow)
    .map((row) => normalizeTeam(row as Record<string, unknown>))
    .filter((t): t is NonNullable<typeof t> => t != null);
}

/** `players.json` — all fantasy players (squadId → nation). */
export function parseFifaPlayersList(raw: unknown): FifaElement[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? ((raw as { players?: unknown[] }).players ??
        (raw as { elements?: unknown[] }).elements)
      : null;
  if (!arr || !Array.isArray(arr)) return [];

  return arr
    .filter((p) => p && typeof p === "object" && !isFifaNationSquadRow(p))
    .map((p) => normalizePlayer(p as Record<string, unknown>))
    .filter((p): p is FifaElement => p != null);
}

export function attachSquadCodes(
  elements: FifaElement[],
  teams: FifaBootstrap["teams"],
): FifaElement[] {
  const codeBySquadId = new Map<number, string>();
  for (const t of teams) {
    const code =
      fifaTeamToWcCode(t) ?? (t.short_name ? String(t.short_name).toUpperCase() : null);
    if (code) codeBySquadId.set(t.id, code);
  }
  return elements.map((el) => ({
    ...el,
    team_code: el.team_code ?? codeBySquadId.get(el.team ?? -1),
  }));
}

export function buildFifaBootstrap(
  playersRaw: unknown,
  squadsRaw: unknown | null,
): FifaBootstrap | null {
  const teams = squadsRaw ? parseFifaSquadsTeams(squadsRaw) : [];
  let elements = parseFifaPlayersList(playersRaw);
  if (elements.length === 0) {
    const legacy = parseFifaPlayerFeedLegacy(playersRaw);
    if (legacy) {
      elements = legacy.elements;
      if (teams.length === 0) return legacy;
    }
  }
  if (elements.length === 0) return null;
  const withCodes = attachSquadCodes(elements, teams);
  return { elements: withCodes, teams };
}

/** FPL-style bootstrap or wrapped feeds. */
function parseFifaPlayerFeedLegacy(raw: unknown): FifaBootstrap | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.data != null) return parseFifaPlayerFeedLegacy(o.data);

  if (Array.isArray(o.elements)) {
    const teams = Array.isArray(o.teams)
      ? o.teams
          .map((t) =>
            t && typeof t === "object"
              ? normalizeTeam(t as Record<string, unknown>)
              : null,
          )
          .filter((t): t is NonNullable<typeof t> => t != null)
      : [];
    const elements = o.elements
      .map((p) =>
        p && typeof p === "object"
          ? normalizePlayer(p as Record<string, unknown>)
          : null,
      )
      .filter((p): p is FifaElement => p != null);
    if (elements.length === 0) return null;
    return { elements, teams };
  }
  return null;
}

/** @deprecated Use buildFifaBootstrap; kept for tests. */
export function parseFifaPlayerFeed(raw: unknown): FifaBootstrap | null {
  if (Array.isArray(raw) && raw.length > 0 && isFifaNationSquadRow(raw[0])) {
    return { elements: [], teams: parseFifaSquadsTeams(raw) };
  }
  return buildFifaBootstrap(raw, null);
}

export function squadsJsonUrl(playersUrl: string): string | null {
  if (!/players\.json/i.test(playersUrl)) return null;
  return playersUrl.replace(/players\.json/i, "squads.json");
}
