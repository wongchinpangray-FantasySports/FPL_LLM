import { getServerSupabase } from "@/lib/supabase";
import { isWcMatchFinished } from "@/lib/wc/fifa-rounds";

const GROUP_MDS = [1, 2, 3] as const;

export type WcProjectionMeta = {
  current_matchday: number | null;
  remaining_matchdays: number[];
  finished_matchdays: number[];
  /** When any group MD is complete, xP totals use remaining fixtures only. */
  fixture_scope: "remaining" | "full";
};

export type WcFixtureRow = {
  id: number;
  matchday: number;
  home_team_id: number;
  away_team_id: number;
  finished?: boolean;
  home_score?: number | null;
  away_score?: number | null;
};

export function applyMatchStatsToFixtures<
  T extends {
    id: number;
    matchday: number;
    home_team_id: number;
    away_team_id: number;
    finished?: boolean;
    home_score?: number | null;
    away_score?: number | null;
  },
>(
  fixtures: T[],
  codeToId: Map<string, number>,
  stats: Array<{
    home_code: string;
    away_code: string;
    round_id: number;
    status: string;
    home_score: number | null;
    away_score: number | null;
  }>,
): T[] {
  const finishedByKey = new Map<
    string,
    { finished: boolean; home_score: number | null; away_score: number | null }
  >();

  for (const row of stats) {
    const md = row.round_id;
    if (md < 1 || md > 3) continue;
    const homeId = codeToId.get(row.home_code);
    const awayId = codeToId.get(row.away_code);
    if (!homeId || !awayId) continue;
    finishedByKey.set(`${md}:${homeId}:${awayId}`, {
      finished: isWcMatchFinished({
        status: row.status,
        home_score: row.home_score,
      }),
      home_score: row.home_score,
      away_score: row.away_score,
    });
  }

  return fixtures.map((fx) => {
    const hit = finishedByKey.get(
      `${fx.matchday}:${fx.home_team_id}:${fx.away_team_id}`,
    );
    if (!hit) return fx;
    return {
      ...fx,
      finished: hit.finished || fx.finished === true,
      home_score: hit.home_score ?? fx.home_score ?? null,
      away_score: hit.away_score ?? fx.away_score ?? null,
    };
  });
}

/** Mark group fixtures finished from cached FIFA scores in wc_match_stats. */
export async function syncWcFixtureStatus(): Promise<number> {
  const supa = getServerSupabase();
  const { data: teams, error: tErr } = await supa.from("wc_teams").select("id,code");
  if (tErr) throw new Error(tErr.message);

  const codeToId = new Map(
    (teams ?? []).map((t) => [t.code as string, t.id as number]),
  );

  const { data: stats, error: sErr } = await supa
    .from("wc_match_stats")
    .select("home_code,away_code,round_id,status,home_score,away_score")
    .lte("round_id", 3);
  if (sErr) throw new Error(sErr.message);

  const { data: fixtures, error: fErr } = await supa
    .from("wc_fixtures")
    .select("id,matchday,home_team_id,away_team_id,finished,home_score,away_score");
  if (fErr) throw new Error(fErr.message);

  const fixtureIndex = new Map<string, WcFixtureRow>();
  for (const fx of fixtures ?? []) {
    fixtureIndex.set(
      `${fx.matchday}:${fx.home_team_id}:${fx.away_team_id}`,
      fx as WcFixtureRow,
    );
  }

  let updated = 0;
  const pending: Array<{
    id: number;
    finished: boolean;
    home_score: number | null;
    away_score: number | null;
  }> = [];

  for (const row of stats ?? []) {
    const md = row.round_id as number;
    if (md < 1 || md > 3) continue;

    const homeId = codeToId.get(row.home_code as string);
    const awayId = codeToId.get(row.away_code as string);
    if (!homeId || !awayId) continue;

    const fx = fixtureIndex.get(`${md}:${homeId}:${awayId}`);
    if (!fx) continue;

    const finished = isWcMatchFinished({
      status: row.status as string,
      home_score: row.home_score as number | null,
    });
    const home_score = row.home_score as number | null;
    const away_score = row.away_score as number | null;

    if (
      fx.finished === finished &&
      fx.home_score === home_score &&
      fx.away_score === away_score
    ) {
      continue;
    }

    pending.push({ id: fx.id, finished, home_score, away_score });
    fx.finished = finished;
    fx.home_score = home_score;
    fx.away_score = away_score;
  }

  const BATCH = 12;
  for (let i = 0; i < pending.length; i += BATCH) {
    const chunk = pending.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map((row) =>
        supa
          .from("wc_fixtures")
          .update({
            finished: row.finished,
            home_score: row.home_score,
            away_score: row.away_score,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id),
      ),
    );
    const err = results.find((r) => r.error)?.error;
    if (err) throw new Error(err.message);
    updated += chunk.length;
  }

  await refreshWcMatchdayFlags(fixtures ?? []);
  return updated;
}

async function refreshWcMatchdayFlags(
  fixtures: { matchday: number; finished?: boolean }[],
): Promise<void> {
  const counts = new Map<number, { total: number; done: number }>();
  for (const md of GROUP_MDS) counts.set(md, { total: 0, done: 0 });

  for (const fx of fixtures) {
    const slot = counts.get(fx.matchday);
    if (!slot) continue;
    slot.total++;
    if (fx.finished) slot.done++;
  }

  const remaining: number[] = [];
  for (const md of GROUP_MDS) {
    const slot = counts.get(md)!;
    if (slot.total === 0 || slot.done < slot.total) remaining.push(md);
  }

  const current = remaining[0] ?? null;
  const next = remaining[1] ?? null;
  const supa = getServerSupabase();

  const { error } = await supa.from("wc_matchdays").upsert(
    GROUP_MDS.map((md) => ({
      id: md,
      is_current: md === current,
      is_next: md === next,
    })),
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}

export function buildWcProjectionMeta(
  fixtures: { matchday: number; finished?: boolean }[],
): WcProjectionMeta {
  const counts = new Map<number, { total: number; done: number }>();
  for (const md of GROUP_MDS) counts.set(md, { total: 0, done: 0 });

  for (const fx of fixtures) {
    const slot = counts.get(fx.matchday);
    if (!slot) continue;
    slot.total++;
    if (fx.finished) slot.done++;
  }

  const finished_matchdays: number[] = [];
  const remaining_matchdays: number[] = [];
  for (const md of GROUP_MDS) {
    const slot = counts.get(md)!;
    if (slot.total > 0 && slot.done >= slot.total) finished_matchdays.push(md);
    else if (slot.total > 0) remaining_matchdays.push(md);
  }

  return {
    current_matchday: remaining_matchdays[0] ?? null,
    remaining_matchdays,
    finished_matchdays,
    fixture_scope:
      finished_matchdays.length > 0 && remaining_matchdays.length > 0
        ? "remaining"
        : "full",
  };
}

export function filterFixturesForProjection<T extends { matchday: number; finished?: boolean }>(
  fixtures: T[],
  meta: WcProjectionMeta,
): T[] {
  if (meta.fixture_scope === "full") return fixtures;
  if (meta.remaining_matchdays.length === 0) return [];
  return fixtures.filter(
    (fx) =>
      meta.remaining_matchdays.includes(fx.matchday) && fx.finished !== true,
  );
}
