import { getServerSupabase } from "@/lib/supabase";
import {
  WC_GROUP_TEAMS,
  WC_PLAYER_SEEDS,
  groupStagePairings,
  rankToStrength,
} from "@/lib/wc/seed-data";

const PLAYER_COLS =
  "fpl_id,web_name,name,position,base_price,form,goals_scored,assists,expected_goals,expected_assists,minutes";

const EXPECTED_TEAMS = WC_GROUP_TEAMS.length;

let seedLock: Promise<{ seeded: boolean }> | null = null;

/** Idempotent: populate WC tables when empty (after migration 0009). Serialized per process. */
export function ensureWcSeeded(): Promise<{ seeded: boolean }> {
  if (!seedLock) {
    seedLock = runSeed().catch((err) => {
      seedLock = null;
      throw err;
    });
  }
  return seedLock;
}

async function tableCount(
  table: "wc_teams" | "wc_matchdays" | "wc_fixtures" | "wc_players",
): Promise<number> {
  const supa = getServerSupabase();
  const { count, error } = await supa
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function runSeed(): Promise<{ seeded: boolean }> {
  const supa = getServerSupabase();
  let didWork = false;

  const [teamCount, mdCount, fxCount, playerCount] = await Promise.all([
    tableCount("wc_teams"),
    tableCount("wc_matchdays"),
    tableCount("wc_fixtures"),
    tableCount("wc_players"),
  ]);

  if (
    teamCount >= EXPECTED_TEAMS &&
    mdCount >= 3 &&
    fxCount > 0 &&
    playerCount > 0
  ) {
    return { seeded: false };
  }

  if (teamCount < EXPECTED_TEAMS) {
    const teamRows = WC_GROUP_TEAMS.map((t) => {
      const s = rankToStrength(t.rank);
      return {
        code: t.code,
        name: t.name,
        short_name: t.short,
        group_letter: t.group,
        attack_strength: s.attack,
        defence_strength: s.defence,
        fifa_rank: t.rank,
      };
    });

    const { error: tErr } = await supa
      .from("wc_teams")
      .upsert(teamRows, { onConflict: "code" });
    if (tErr) throw new Error(tErr.message);
    didWork = true;
  }

  const { data: allTeams, error: loadErr } = await supa
    .from("wc_teams")
    .select("id,code,group_letter");
  if (loadErr) throw new Error(loadErr.message);
  if ((allTeams?.length ?? 0) < EXPECTED_TEAMS) {
    throw new Error(
      `WC seed incomplete: expected ${EXPECTED_TEAMS} teams, found ${allTeams?.length ?? 0}`,
    );
  }

  const teamByCode = new Map(
    (allTeams ?? []).map((r) => [r.code as string, r.id as number]),
  );
  const teamsByGroup = new Map<string, number[]>();
  for (const t of allTeams ?? []) {
    const g = t.group_letter as string;
    const list = teamsByGroup.get(g) ?? [];
    list.push(t.id as number);
    teamsByGroup.set(g, list);
  }

  if (mdCount < 3) {
    const matchdayRows = [1, 2, 3].map((id) => ({
      id,
      name: `Matchday ${id}`,
      is_current: id === 1,
      is_next: id === 2,
    }));
    const { error: mdErr } = await supa
      .from("wc_matchdays")
      .upsert(matchdayRows, { onConflict: "id" });
    if (mdErr) throw new Error(mdErr.message);
    didWork = true;
  }

  if (fxCount === 0) {
    const fixtureRows: {
      matchday: number;
      home_team_id: number;
      away_team_id: number;
    }[] = [];

    for (const [, teamIds] of teamsByGroup) {
      if (teamIds.length !== 4) continue;
      const ids = teamIds as [number, number, number, number];
      const pairings = groupStagePairings(ids);
      pairings.forEach(([home, away, home2, away2], mdIdx) => {
        const md = mdIdx + 1;
        fixtureRows.push({
          matchday: md,
          home_team_id: home,
          away_team_id: away,
        });
        fixtureRows.push({
          matchday: md,
          home_team_id: home2,
          away_team_id: away2,
        });
      });
    }

    const { error: fxErr } = await supa.from("wc_fixtures").insert(fixtureRows);
    if (fxErr) throw new Error(fxErr.message);
    didWork = true;
  }

  if (playerCount === 0) {
    const validCodes = new Set(WC_GROUP_TEAMS.map((t) => t.code));
    const fplIds = WC_PLAYER_SEEDS.map((p) => p.fpl_id).filter(
      (id): id is number => id != null,
    );

    const fplById = new Map<number, Record<string, unknown>>();
    if (fplIds.length > 0) {
      const { data: fplRows } = await supa
        .from("players_static")
        .select(PLAYER_COLS)
        .in("fpl_id", fplIds);
      for (const r of fplRows ?? []) {
        fplById.set(r.fpl_id as number, r as Record<string, unknown>);
      }
    }

    const playerRows = WC_PLAYER_SEEDS.filter((p) =>
      validCodes.has(p.teamCode),
    )
      .map((p) => {
        const wc_team_id = teamByCode.get(p.teamCode);
        if (wc_team_id == null) return null;
        const fpl = p.fpl_id != null ? fplById.get(p.fpl_id) : undefined;
        return {
          wc_team_id,
          name: (fpl?.web_name as string) ?? p.name,
          fpl_id: p.fpl_id ?? null,
          position: (fpl?.position as string) ?? p.position,
          price:
            (fpl?.base_price as number | null) ?? p.price ?? 6.0,
          goals: (fpl?.goals_scored as number | null) ?? p.goals ?? 0,
          assists: (fpl?.assists as number | null) ?? p.assists ?? 0,
          xg: (fpl?.expected_goals as number | null) ?? p.xg ?? 0,
          xa: (fpl?.expected_assists as number | null) ?? p.xa ?? 0,
          form: (fpl?.form as number | null) ?? p.form ?? 0,
          minutes: (fpl?.minutes as number | null) ?? p.minutes ?? 0,
        };
      })
      .filter(Boolean);

    const { error: pErr } = await supa.from("wc_players").insert(playerRows);
    if (pErr) throw new Error(pErr.message);
    didWork = true;
  }

  return { seeded: didWork };
}
