import type { WcMatchRow, WcTeamMatchStats } from "@/lib/wc/fifa-rounds";

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE = 1;
const WC_SEASON = 2026;

/** API-Football team labels that differ from FIFA fantasy names. */
const FIFA_TO_API_TEAM: Record<string, string> = {
  "Korea Republic": "South Korea",
  "Korea republic": "South Korea",
  "USA": "USA",
  "United States": "USA",
  "Czechia": "Czech Republic",
  "Côte d'Ivoire": "Ivory Coast",
  "Cote d'Ivoire": "Ivory Coast",
  "IR Iran": "Iran",
  "Cabo Verde": "Cape Verde",
  "Curaçao": "Curacao",
};

type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  teams: {
    home: { name: string };
    away: { name: string };
  };
};

type ApiStatRow = { type: string; value: number | string | null };

let fixtureCache: { at: number; rows: ApiFixture[] } | null = null;
const FIXTURE_CACHE_MS = 10 * 60 * 1000;

function apiKey(): string | null {
  const k = process.env.API_FOOTBALL_KEY?.trim();
  return k || null;
}

export function isApiFootballConfigured(): boolean {
  return Boolean(apiKey());
}

function normTeam(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function apiTeamName(fifaName: string): string {
  return FIFA_TO_API_TEAM[fifaName] ?? fifaName;
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

async function loadFixtures(): Promise<ApiFixture[]> {
  if (fixtureCache && Date.now() - fixtureCache.at < FIXTURE_CACHE_MS) {
    return fixtureCache.rows;
  }
  const rows = await apiFetch<ApiFixture[]>(
    `/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}`,
  );
  fixtureCache = { at: Date.now(), rows };
  return rows;
}

function findFixture(
  fixtures: ApiFixture[],
  match: WcMatchRow,
): ApiFixture | null {
  const home = normTeam(apiTeamName(match.home_name));
  const away = normTeam(apiTeamName(match.away_name));
  const kick = match.kickoff ? Date.parse(match.kickoff) : NaN;

  let best: ApiFixture | null = null;
  let bestDelta = Infinity;

  for (const fx of fixtures) {
    const h = normTeam(fx.teams.home.name);
    const a = normTeam(fx.teams.away.name);
    const teamsMatch =
      (h === home && a === away) || (h === away && a === home);
    if (!teamsMatch) continue;
    if (!Number.isFinite(kick)) return fx;
    const delta = Math.abs(Date.parse(fx.fixture.date) - kick);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = fx;
    }
  }
  return bestDelta <= 36 * 60 * 60 * 1000 ? best : null;
}

function parseStatValue(raw: number | string | null): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return raw;
  const n = Number(String(raw).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

function mapApiStats(rows: ApiStatRow[]): WcTeamMatchStats {
  const byType = new Map(rows.map((r) => [r.type.toLowerCase(), r.value]));
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = byType.get(k.toLowerCase());
      const n = parseStatValue(v ?? null);
      if (n != null) return n;
    }
    return null;
  };
  return {
    xg: get("expected goals", "expected_goals"),
    shots: get("total shots"),
    shots_on_target: get("shots on goal", "shots on target"),
    possession: get("ball possession"),
    corners: get("corner kicks", "corners"),
    fouls: get("fouls"),
  };
}

export async function fetchMatchOptaStats(
  match: WcMatchRow,
): Promise<{ home: WcTeamMatchStats; away: WcTeamMatchStats } | null> {
  if (!apiKey()) return null;
  if (match.status !== "finished" && match.home_score == null) return null;

  const fixtures = await loadFixtures();
  const fx = findFixture(fixtures, match);
  if (!fx) return null;

  const stats = await apiFetch<
    { team: { name: string }; statistics: ApiStatRow[] }[]
  >(`/fixtures/statistics?fixture=${fx.fixture.id}`);

  if (!stats?.length) return null;

  const homeApi = normTeam(apiTeamName(match.home_name));
  const homeRow = stats.find((s) => normTeam(s.team.name) === homeApi);
  const awayRow = stats.find((s) => normTeam(s.team.name) !== homeApi);

  if (!homeRow || !awayRow) {
    if (stats.length >= 2) {
      return {
        home: mapApiStats(stats[0]!.statistics),
        away: mapApiStats(stats[1]!.statistics),
      };
    }
    return null;
  }

  return {
    home: mapApiStats(homeRow.statistics),
    away: mapApiStats(awayRow.statistics),
  };
}
