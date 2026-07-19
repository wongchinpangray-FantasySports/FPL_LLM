/**
 * Enrich pre-season rows with kickoff times and goal events from API-Football.
 */

const API_BASE = "https://v3.football.api-sports.io";

const PL_API_TEAM_IDS: Record<string, number> = {
  ARS: 42,
  AVL: 66,
  BOU: 35,
  BRE: 55,
  BHA: 51,
  CHE: 49,
  COV: 134,
  CRY: 52,
  EVE: 45,
  FUL: 36,
  HUL: 70,
  IPS: 57,
  LEE: 63,
  LIV: 40,
  MCI: 50,
  MUN: 33,
  NEW: 34,
  NFO: 65,
  SUN: 746,
  TOT: 47,
};

type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
};

type ApiEvent = {
  time: { elapsed: number; extra: number | null };
  team: { name: string };
  player: { name: string } | null;
  assist: { name: string } | null;
  type: string;
  detail: string;
};

export type PreseasonGoal = {
  minute: string;
  scorer: string;
  assist: string | null;
  side: "pl" | "opp";
};

export type PreseasonMatchEnriched = {
  kickoff_time: string | null;
  goals: PreseasonGoal[];
};

let fixtureCache: {
  at: number;
  byTeam: Map<number, ApiFixture[]>;
} | null = null;

const CACHE_MS = 15 * 60 * 1000;

function apiKey(): string | null {
  return process.env.API_FOOTBALL_KEY?.trim() || null;
}

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function opponentMatches(apiName: string, opponent: string): boolean {
  const a = norm(apiName);
  const b = norm(opponent);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const bTokens = b.split(" ").filter((t) => t.length > 2);
  if (bTokens.length === 0) return false;
  return bTokens.every((t) => a.includes(t));
}

async function apiFetch<T>(path: string): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("API_FOOTBALL_KEY not set");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const body = (await res.json()) as { response?: T; errors?: unknown };
  if (body.errors && Object.keys(body.errors as object).length > 0) {
    throw new Error("API-Football request failed");
  }
  return (body.response ?? []) as T;
}

async function loadTeamFixtures(teamId: number): Promise<ApiFixture[]> {
  if (fixtureCache && Date.now() - fixtureCache.at < CACHE_MS) {
    return fixtureCache.byTeam.get(teamId) ?? [];
  }

  const byTeam = new Map<number, ApiFixture[]>();
  const ids = [...new Set(Object.values(PL_API_TEAM_IDS))];

  await Promise.all(
    ids.map(async (id) => {
      try {
        const rows = await apiFetch<ApiFixture[]>(
          `/fixtures?team=${id}&from=2026-07-01&to=2026-08-20`,
        );
        byTeam.set(id, rows ?? []);
      } catch {
        byTeam.set(id, []);
      }
    }),
  );

  fixtureCache = { at: Date.now(), byTeam };
  return byTeam.get(teamId) ?? [];
}

function formatMinute(elapsed: number, extra: number | null): string {
  if (extra && extra > 0) return `${elapsed}+${extra}'`;
  return `${elapsed}'`;
}

function findFixture(
  fixtures: ApiFixture[],
  opponent: string,
  date: string,
): ApiFixture | null {
  for (const fx of fixtures) {
    if (fx.fixture.date.slice(0, 10) !== date) continue;
    if (
      opponentMatches(fx.teams.home.name, opponent) ||
      opponentMatches(fx.teams.away.name, opponent)
    ) {
      return fx;
    }
  }
  return null;
}

async function loadGoalEvents(
  fixtureId: number,
  plHome: boolean,
  fx: ApiFixture,
): Promise<PreseasonGoal[]> {
  const events = await apiFetch<ApiEvent[]>(
    `/fixtures/events?fixture=${fixtureId}`,
  );
  if (!events?.length) return [];

  const goals: PreseasonGoal[] = [];
  for (const ev of events) {
    if (ev.type !== "Goal") continue;
    const scorer = ev.player?.name?.trim();
    if (!scorer) continue;
    const isHomeTeam = norm(ev.team.name) === norm(fx.teams.home.name);
    const isPlTeam = plHome ? isHomeTeam : !isHomeTeam;
    const isOwnGoal = ev.detail.toLowerCase().includes("own");

    goals.push({
      minute: formatMinute(ev.time.elapsed, ev.time.extra),
      scorer,
      assist: ev.assist?.name?.trim() ?? null,
      side: isOwnGoal ? (isPlTeam ? "opp" : "pl") : isPlTeam ? "pl" : "opp",
    });
  }

  goals.sort((a, b) => {
    const ma = parseInt(a.minute, 10) || 0;
    const mb = parseInt(b.minute, 10) || 0;
    return ma - mb;
  });

  return goals;
}

export async function enrichPreseasonMatch(
  match: {
    date: string;
    pl_code: string;
    pl_name: string;
    opponent: string;
    pl_home: boolean;
    status: string;
    kickoff_time?: string | null;
    goals?: PreseasonGoal[];
  },
): Promise<PreseasonMatchEnriched> {
  const base: PreseasonMatchEnriched = {
    kickoff_time: match.kickoff_time ?? null,
    goals: match.goals ?? [],
  };

  if (!apiKey()) return base;

  const teamId = PL_API_TEAM_IDS[match.pl_code];
  if (!teamId) return base;

  try {
    const fixtures = await loadTeamFixtures(teamId);
    const fx = findFixture(fixtures, match.opponent, match.date);
    if (!fx) return base;

    const kickoff_time = fx.fixture.date;
    let goals = base.goals;

    if (
      match.status === "finished" &&
      (fx.fixture.status.short === "FT" ||
        fx.fixture.status.short === "AET" ||
        fx.fixture.status.short === "PEN")
    ) {
      const fetched = await loadGoalEvents(fx.fixture.id, match.pl_home, fx);
      // Prefer API events when they add detail; keep curated static rows otherwise.
      if (fetched.length >= (base.goals?.length ?? 0)) {
        goals = fetched.length > 0 ? fetched : base.goals;
      }
    }

    return { kickoff_time, goals };
  } catch {
    return base;
  }
}

export async function enrichPreseasonMatches<
  T extends {
    date: string;
    pl_code: string;
    pl_name: string;
    opponent: string;
    pl_home: boolean;
    status: string;
    kickoff_time?: string | null;
    goals?: PreseasonGoal[];
  },
>(matches: T[]): Promise<(T & PreseasonMatchEnriched)[]> {
  if (!apiKey()) {
    return matches.map((m) => ({
      ...m,
      kickoff_time: m.kickoff_time ?? null,
      goals: m.goals ?? [],
    }));
  }

  const out: (T & PreseasonMatchEnriched)[] = [];
  for (const m of matches) {
    const enriched = await enrichPreseasonMatch(m);
    out.push({ ...m, ...enriched });
  }
  return out;
}

export function isPreseasonApiConfigured(): boolean {
  return Boolean(apiKey());
}
