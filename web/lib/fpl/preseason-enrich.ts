import type { PreseasonBundle } from "@/lib/fpl/preseason";
import { opponentNamesMatch } from "@/lib/fpl/preseason-opponents";
import {
  loadCachedPreseasonExternalResults,
  mergeExternalResultsOntoMatch,
} from "@/lib/fpl/preseason-sources";
import {
  fetchGoalsForFinishedMatch,
  findReportUrlsForMatch,
  needsPreseasonGoalFetch,
} from "@/lib/fpl/preseason-scorers";

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

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

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
  status: "finished" | "scheduled";
  pl_goals: number | null;
  opp_goals: number | null;
};

export type PreseasonMatchInput = {
  date: string;
  pl_code: string;
  pl_name: string;
  opponent: string;
  pl_home: boolean;
  status: "finished" | "scheduled" | string;
  pl_goals?: number | null;
  opp_goals?: number | null;
  kickoff_time?: string | null;
  goals?: PreseasonGoal[];
};

let fixtureCache: {
  at: number;
  byTeam: Map<number, ApiFixture[]>;
} | null = null;

const CACHE_MS = 5 * 60 * 1000;

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
  return opponentNamesMatch(apiName, opponent);
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
  const tryDates = [date];
  const d = new Date(`${date}T12:00:00Z`);
  if (!Number.isNaN(d.getTime())) {
    const prev = new Date(d);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    tryDates.push(prev.toISOString().slice(0, 10), next.toISOString().slice(0, 10));
  }

  for (const day of tryDates) {
    for (const fx of fixtures) {
      if (fx.fixture.date.slice(0, 10) !== day) continue;
      if (
        opponentMatches(fx.teams.home.name, opponent) ||
        opponentMatches(fx.teams.away.name, opponent)
      ) {
        return fx;
      }
    }
  }
  return null;
}

function isFixtureFinished(status: string): boolean {
  return FINISHED_STATUSES.has(status);
}

function scoresFromFixture(
  fx: ApiFixture,
  plHome: boolean,
): { pl_goals: number; opp_goals: number } | null {
  const home = fx.goals.home;
  const away = fx.goals.away;
  if (home == null || away == null) return null;
  return plHome
    ? { pl_goals: home, opp_goals: away }
    : { pl_goals: away, opp_goals: home };
}

function goalsWithMinutes(goals: PreseasonGoal[]): number {
  return goals.filter((g) => g.minute.trim().length > 0).length;
}

function pickGoals(
  existing: PreseasonGoal[],
  fetched: PreseasonGoal[],
): PreseasonGoal[] {
  if (fetched.length === 0) return existing;
  const existingMinutes = goalsWithMinutes(existing);
  const fetchedMinutes = goalsWithMinutes(fetched);
  if (fetchedMinutes > existingMinutes) return fetched;
  if (fetched.length > existing.length && fetchedMinutes >= existingMinutes) {
    return fetched;
  }
  return existing.length > 0 ? existing : fetched;
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

function baseEnrichment(match: PreseasonMatchInput): PreseasonMatchEnriched {
  return {
    kickoff_time: match.kickoff_time ?? null,
    goals: match.goals ?? [],
    status: match.status === "finished" ? "finished" : "scheduled",
    pl_goals: match.pl_goals ?? null,
    opp_goals: match.opp_goals ?? null,
  };
}

/** Clear in-memory fixture cache (for sync scripts). */
export function clearPreseasonFixtureCache(): void {
  fixtureCache = null;
}

export async function resolvePreseasonMatchFromApi(
  match: PreseasonMatchInput,
): Promise<PreseasonMatchEnriched | null> {
  if (!apiKey()) return null;

  const teamId = PL_API_TEAM_IDS[match.pl_code];
  if (!teamId) return null;

  try {
    const fixtures = await loadTeamFixtures(teamId);
    const fx = findFixture(fixtures, match.opponent, match.date);
    if (!fx) return null;

    const base = baseEnrichment(match);
    const kickoff_time = fx.fixture.date;
    let { status, pl_goals, opp_goals, goals } = base;

    if (isFixtureFinished(fx.fixture.status.short)) {
      const scores = scoresFromFixture(fx, match.pl_home);
      if (scores) {
        status = "finished";
        pl_goals = scores.pl_goals;
        opp_goals = scores.opp_goals;
        const fetched = await loadGoalEvents(fx.fixture.id, match.pl_home, fx);
        goals = pickGoals(base.goals, fetched);
      }
    } else if (status === "finished") {
      const fetched = await loadGoalEvents(fx.fixture.id, match.pl_home, fx);
      goals = pickGoals(base.goals, fetched);
    }

    return { kickoff_time, goals, status, pl_goals, opp_goals };
  } catch {
    return null;
  }
}

export function preseasonMatchChanged(
  before: PreseasonMatchInput,
  after: PreseasonMatchEnriched,
): boolean {
  return (
    (before.kickoff_time ?? null) !== after.kickoff_time ||
    before.status !== after.status ||
    (before.pl_goals ?? null) !== after.pl_goals ||
    (before.opp_goals ?? null) !== after.opp_goals ||
    JSON.stringify(before.goals ?? []) !== JSON.stringify(after.goals)
  );
}

export async function enrichPreseasonMatch(
  match: PreseasonMatchInput,
): Promise<PreseasonMatchEnriched> {
  const base = baseEnrichment(match);
  const resolved = await resolvePreseasonMatchFromApi(match);
  return resolved ?? base;
}

export async function enrichPreseasonMatches<
  T extends PreseasonMatchInput,
>(matches: T[]): Promise<(T & PreseasonMatchEnriched)[]> {
  return enrichPreseasonMatchesFromSources(matches);
}

export async function enrichPreseasonMatchesFromSources<
  T extends PreseasonMatchInput,
>(matches: T[]): Promise<(T & PreseasonMatchEnriched)[]> {
  const external = await loadCachedPreseasonExternalResults();
  const out: (T & PreseasonMatchEnriched)[] = [];

  for (const m of matches) {
    const merged = mergeExternalResultsOntoMatch(m, external);
    const base = baseEnrichment(merged);
    const api = apiKey() ? await resolvePreseasonMatchFromApi(merged) : null;

    let kickoff_time = base.kickoff_time;
    let goals = base.goals;
    let status = base.status;
    let pl_goals = base.pl_goals;
    let opp_goals = base.opp_goals;

    if (api) {
      kickoff_time = api.kickoff_time ?? kickoff_time;
      if (api.goals.length >= goals.length) {
        goals = api.goals.length > 0 ? api.goals : goals;
      }
      if (status !== "finished" && api.status === "finished") {
        status = api.status;
        pl_goals = api.pl_goals;
        opp_goals = api.opp_goals;
      }
    }

    const enriched = {
      ...m,
      kickoff_time,
      goals,
      status,
      pl_goals,
      opp_goals,
    };

    if (needsPreseasonGoalFetch(enriched)) {
      const reportUrls = findReportUrlsForMatch(enriched, external);
      const fetchedGoals = await fetchGoalsForFinishedMatch(
        enriched,
        reportUrls,
      );
      if (fetchedGoals.length > goals.length) {
        goals = fetchedGoals;
      }
    }

    out.push({
      ...m,
      kickoff_time,
      goals,
      status,
      pl_goals,
      opp_goals,
    });
  }

  return out;
}

export async function loadPreseasonBundleWithSources(
  base: PreseasonBundle,
): Promise<PreseasonBundle> {
  const matches = await enrichPreseasonMatchesFromSources(base.matches);
  return { ...base, matches };
}

export function isPreseasonApiConfigured(): boolean {
  return Boolean(apiKey());
}
