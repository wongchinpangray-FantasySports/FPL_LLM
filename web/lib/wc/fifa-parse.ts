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

function normalizePlayer(raw: Record<string, unknown>, teamId?: number): FifaElement | null {
  const id = num(raw.id ?? raw.player_id ?? raw.element_id ?? raw.playerId);
  if (id <= 0) return null;

  const name =
    str(raw.web_name) ||
    str(raw.display_name) ||
    str(raw.name) ||
    str(raw.short_name) ||
    `${str(raw.first_name)} ${str(raw.second_name)}`.trim();
  if (!name) return null;

  const country =
    str(raw.country) ||
    str(raw.nation) ||
    str(raw.national_team) ||
    str(raw.team_code) ||
    str(raw.country_code) ||
    str(raw.countryCode);
  const teamCode = country ? fifaTeamToWcCode({ short_name: country, name: country }) : null;

  const posLabel = str(raw.position ?? raw.pos ?? raw.role ?? raw.element_type);
  const element_type =
    typeof raw.element_type === "number"
      ? raw.element_type
      : posFromLabel(posLabel);

  return {
    id,
    web_name: name,
    first_name: str(raw.first_name) || undefined,
    second_name: str(raw.second_name) || undefined,
    team: teamId ?? num(raw.team ?? raw.team_id ?? raw.squad_id ?? raw.national_team_id),
    team_code: teamCode ?? undefined,
    element_type,
    position_label: posLabel || undefined,
    now_cost: num(raw.now_cost ?? raw.price ?? raw.cost),
    form: raw.form as string | number | undefined,
    goals_scored: num(raw.goals_scored ?? raw.goals),
    assists: num(raw.assists),
    expected_goals: (raw.expected_goals ?? raw.xg) as string | number | undefined,
    expected_assists: (raw.expected_assists ?? raw.xa) as string | number | undefined,
    minutes: num(raw.minutes),
  };
}

function normalizeTeam(raw: Record<string, unknown>): FifaBootstrap["teams"][0] | null {
  const id = num(raw.id ?? raw.team_id ?? raw.squad_id);
  if (id <= 0) return null;
  return {
    id,
    code: raw.code as number | string | undefined,
    name: str(raw.name) || str(raw.team_name) || undefined,
    short_name:
      str(raw.short_name) || str(raw.code) || str(raw.abbreviation) || undefined,
  };
}

function fromElements(
  elements: FifaElement[],
  teams: FifaBootstrap["teams"],
): FifaBootstrap | null {
  if (elements.length === 0) return null;
  return { elements, teams };
}

function playersFromSquads(squads: unknown[]): {
  elements: FifaElement[];
  teams: FifaBootstrap["teams"];
} {
  const elements: FifaElement[] = [];
  const teams: FifaBootstrap["teams"] = [];

  for (const sq of squads) {
    if (!sq || typeof sq !== "object") continue;
    const s = sq as Record<string, unknown>;
    const team = normalizeTeam(s);
    const teamId = team?.id;
    if (team) teams.push(team);

    const roster = s.players ?? s.squad ?? s.elements ?? s.roster;
    if (!Array.isArray(roster)) continue;
    for (const p of roster) {
      if (!p || typeof p !== "object") continue;
      const el = normalizePlayer(p as Record<string, unknown>, teamId);
      if (el) elements.push(el);
    }
  }
  return { elements, teams };
}

/** Normalize play.fifa.com `players.json`, FPL bootstrap, or squad feeds. */
export function parseFifaPlayerFeed(raw: unknown): FifaBootstrap | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    const elements = raw
      .map((p) =>
        p && typeof p === "object"
          ? normalizePlayer(p as Record<string, unknown>)
          : null,
      )
      .filter((p): p is FifaElement => p != null);
    return fromElements(elements, []);
  }

  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (o.data != null) return parseFifaPlayerFeed(o.data);

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
    return fromElements(elements, teams);
  }

  if (Array.isArray(o.players)) {
    const teams = Array.isArray(o.teams)
      ? o.teams
          .map((t) =>
            t && typeof t === "object"
              ? normalizeTeam(t as Record<string, unknown>)
              : null,
          )
          .filter((t): t is NonNullable<typeof t> => t != null)
      : [];
    const elements = o.players
      .map((p) =>
        p && typeof p === "object"
          ? normalizePlayer(p as Record<string, unknown>)
          : null,
      )
      .filter((p): p is FifaElement => p != null);
    return fromElements(elements, teams);
  }

  if (Array.isArray(o.squads) || Array.isArray(o.teams)) {
    const { elements, teams } = playersFromSquads(
      (o.squads ?? o.teams) as unknown[],
    );
    return fromElements(elements, teams);
  }

  return null;
}

/** If URL ends with `players.json`, also try `squads.json` on the same base. */
export function companionFifaFeedUrls(primaryUrl: string): string[] {
  const urls = [primaryUrl];
  if (/players\.json/i.test(primaryUrl)) {
    urls.push(primaryUrl.replace(/players\.json/i, "squads.json"));
  }
  return [...new Set(urls)];
}
