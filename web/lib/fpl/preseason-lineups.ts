import type { PreseasonLineup, PreseasonMatch } from "@/lib/fpl/preseason";
import {
  getPreseasonFixtureContext,
  loadPreseasonFixtureEvents,
} from "@/lib/fpl/preseason-enrich";

const API_BASE = "https://v3.football.api-sports.io";

type ApiLineupPlayer = {
  id: number;
  name: string;
  number?: number | null;
};

type ApiLineupRow = {
  team: { id: number; name: string };
  formation: string | null;
  startXI: Array<{ player: ApiLineupPlayer }>;
  substitutes: Array<{ player: ApiLineupPlayer }>;
};

function apiKey(): string | null {
  return process.env.API_FOOTBALL_KEY?.trim() || null;
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

function normName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function pickPlLineupRow(
  rows: ApiLineupRow[],
  plTeamId: number,
  plName: string,
): ApiLineupRow | null {
  const byId = rows.find((r) => r.team.id === plTeamId);
  if (byId) return byId;
  const plNorm = normName(plName);
  return (
    rows.find((r) => {
      const n = normName(r.team.name);
      return n.includes(plNorm.split(" ")[0] ?? plNorm) || plNorm.includes(n.split(" ")[0] ?? n);
    }) ?? null
  );
}

export function preseasonLineupChanged(
  before: PreseasonLineup | null | undefined,
  after: PreseasonLineup | null | undefined,
): boolean {
  return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
}

export async function resolvePreseasonLineupFromApi(
  match: PreseasonMatch,
  plTeamId: number,
): Promise<PreseasonLineup | null> {
  if (!apiKey() || match.status !== "finished") return null;

  try {
    const ctx = await getPreseasonFixtureContext(match);
    if (!ctx) return null;

    const rows = await apiFetch<ApiLineupRow[]>(
      `/fixtures/lineups?fixture=${ctx.fixtureId}`,
    );
    if (!rows?.length) return null;

    const plRow = pickPlLineupRow(rows, plTeamId, match.pl_name);
    if (!plRow?.startXI?.length) return null;

    const subMinutes = await loadPreseasonFixtureEvents(
      ctx.fixtureId,
      ctx.plHome,
      ctx.fx,
    ).then((events) => {
        const map = new Map<string, number>();
        for (const ev of events) {
          if (ev.type !== "subst") continue;
          if (ev.side !== "pl") continue;
          const playerIn = ev.playerIn?.trim();
          if (playerIn) map.set(normName(playerIn), ev.minute);
        }
        return map;
      },
    );

    const starters = plRow.startXI.map(({ player }) => ({
      name: player.name.trim(),
      number: player.number ?? null,
    }));

    const subs = (plRow.substitutes ?? []).map(({ player }) => ({
      name: player.name.trim(),
      number: player.number ?? null,
      minute_on: subMinutes.get(normName(player.name)) ?? null,
    }));

    return {
      formation: plRow.formation?.trim() || null,
      starters,
      subs,
    };
  } catch {
    return null;
  }
}
