import { getServerSupabase } from "@/lib/supabase";
import {
  WC_GROUP_TEAMS,
  WC_PLAYER_SEEDS,
  groupStagePairings,
  rankToStrength,
} from "@/lib/wc/seed-data";

const PLAYER_COLS =
  "fpl_id,web_name,name,position,base_price,form,goals_scored,assists,expected_goals,expected_assists,minutes";

/** Idempotent: populate WC tables when empty (after migration 0009). */
export async function ensureWcSeeded(): Promise<{ seeded: boolean }> {
  const supa = getServerSupabase();
  const { count } = await supa
    .from("wc_teams")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) > 0) return { seeded: false };

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

  const { data: insertedTeams, error: tErr } = await supa
    .from("wc_teams")
    .insert(teamRows)
    .select("id,code,group_letter");

  if (tErr) throw new Error(tErr.message);

  const teamByCode = new Map(
    (insertedTeams ?? []).map((r) => [r.code as string, r.id as number]),
  );
  const teamsByGroup = new Map<string, number[]>();
  for (const t of insertedTeams ?? []) {
    const g = t.group_letter as string;
    const list = teamsByGroup.get(g) ?? [];
    list.push(t.id as number);
    teamsByGroup.set(g, list);
  }

  const matchdayRows = [1, 2, 3].map((id) => ({
    id,
    name: `Matchday ${id}`,
    is_current: id === 1,
    is_next: id === 2,
  }));
  const { error: mdErr } = await supa.from("wc_matchdays").insert(matchdayRows);
  if (mdErr) throw new Error(mdErr.message);

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
      fixtureRows.push({ matchday: md, home_team_id: home, away_team_id: away });
      fixtureRows.push({
        matchday: md,
        home_team_id: home2,
        away_team_id: away2,
      });
    });
  }

  const { error: fxErr } = await supa.from("wc_fixtures").insert(fixtureRows);
  if (fxErr) throw new Error(fxErr.message);

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
  ).map((p) => {
    const wc_team_id = teamByCode.get(p.teamCode);
    if (wc_team_id == null) return null;
    const fpl = p.fpl_id != null ? fplById.get(p.fpl_id) : undefined;
    return {
      wc_team_id,
      name: (fpl?.web_name as string) ?? p.name,
      fpl_id: p.fpl_id ?? null,
      position: (fpl?.position as string) ?? p.position,
      price:
        (fpl?.base_price as number | null) ??
        p.price ??
        6.0,
      goals: (fpl?.goals_scored as number | null) ?? p.goals ?? 0,
      assists: (fpl?.assists as number | null) ?? p.assists ?? 0,
      xg: (fpl?.expected_goals as number | null) ?? p.xg ?? 0,
      xa: (fpl?.expected_assists as number | null) ?? p.xa ?? 0,
      form: (fpl?.form as number | null) ?? p.form ?? 0,
      minutes: (fpl?.minutes as number | null) ?? p.minutes ?? 0,
    };
  }).filter(Boolean);

  const { error: pErr } = await supa.from("wc_players").insert(playerRows);
  if (pErr) throw new Error(pErr.message);

  return { seeded: true };
}
