import { getServerSupabase } from "@/lib/supabase";
import {
  WC_GROUP_TEAMS,
  groupStagePairings,
  rankToStrength,
} from "@/lib/wc/seed-data";
import {
  syncWcPlayersFromFifa,
  WC_MIN_PLAYER_POOL,
} from "@/lib/wc/fifa-sync";
import { replaceExpandedWcPlayers } from "@/lib/wc/fpl-wc-pool";

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

  // Always refresh team strengths so FDR quintiles use the latest model.
  {
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
    const { error: refreshErr } = await supa
      .from("wc_teams")
      .upsert(teamRows, { onConflict: "code" });
    if (refreshErr) throw new Error(refreshErr.message);
  }

  if (
    teamCount >= EXPECTED_TEAMS &&
    mdCount >= 3 &&
    fxCount > 0 &&
    playerCount >= WC_MIN_PLAYER_POOL
  ) {
    const { count: fifaCount } = await supa
      .from("wc_players")
      .select("id", { count: "exact", head: true })
      .eq("source", "fifa");
    const { count: fplCount } = await supa
      .from("wc_players")
      .select("id", { count: "exact", head: true })
      .eq("source", "fpl");
    const legacyFuzzyFplPool =
      (fifaCount ?? 0) < 100 && (fplCount ?? 0) > 35;
    if (legacyFuzzyFplPool) {
      const { data: allTeams } = await supa.from("wc_teams").select("id,code");
      const teamByCode = new Map(
        (allTeams ?? []).map((r) => [r.code as string, r.id as number]),
      );
      const validCodes = new Set(WC_GROUP_TEAMS.map((t) => t.code));
      await replaceExpandedWcPlayers(supa, teamByCode, validCodes);
      return { seeded: true };
    }
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

  if (playerCount < WC_MIN_PLAYER_POOL) {
    const validCodes = new Set(WC_GROUP_TEAMS.map((t) => t.code));
    const fifa = await syncWcPlayersFromFifa();
    const afterFifa = fifa.skipped ? playerCount : await tableCount("wc_players");

    if (afterFifa < WC_MIN_PLAYER_POOL) {
      const n = await replaceExpandedWcPlayers(supa, teamByCode, validCodes);
      if (n > 0) didWork = true;
    } else if (!fifa.skipped) {
      didWork = true;
    }
  }

  return { seeded: didWork };
}
