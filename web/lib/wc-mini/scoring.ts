import { getServerSupabase } from "@/lib/supabase";
import { scoreMiniSquad, type GwStatRow } from "@/lib/mini/scoring";
import type { WcMatchGoal } from "@/lib/wc/fifa-rounds";
import { normalizeMatchGoals } from "@/lib/wc/fifa-rounds";

const GOAL_PTS: Record<string, number> = { GKP: 6, DEF: 6, MID: 5, FWD: 4 };
const CS_PTS: Record<string, number> = { GKP: 4, DEF: 4, MID: 1, FWD: 0 };

type PlayerMeta = { id: number; position: string; wc_team_id: number; fifa_element_id: number | null };

function goalPoints(position: string): number {
  return GOAL_PTS[position] ?? 5;
}

function csPoints(position: string): number {
  return CS_PTS[position] ?? 0;
}

function parseGoals(raw: unknown): WcMatchGoal[] {
  return normalizeMatchGoals(raw);
}

export async function buildWcMatchdayStats(
  matchday: number,
  playerIds: number[],
): Promise<Map<number, GwStatRow>> {
  const out = new Map<number, GwStatRow>();
  if (playerIds.length === 0) return out;

  const supa = getServerSupabase();
  const { data: players } = await supa
    .from("wc_players")
    .select("id,position,wc_team_id,fifa_element_id")
    .in("id", playerIds);

  const metaById = new Map<number, PlayerMeta>();
  const fifaToWc = new Map<number, number>();
  for (const p of players ?? []) {
    const id = p.id as number;
    metaById.set(id, {
      id,
      position: p.position as string,
      wc_team_id: p.wc_team_id as number,
      fifa_element_id: (p.fifa_element_id as number | null) ?? null,
    });
    if (p.fifa_element_id != null) {
      fifaToWc.set(p.fifa_element_id as number, id);
    }
  }

  for (const id of playerIds) {
    out.set(id, { player_id: id, total_points: 0, minutes: 0 });
  }

  const { data: matches } = await supa
    .from("wc_match_stats")
    .select(
      "round_id,home_code,away_code,home_score,away_score,status,home_goals,away_goals,home_cards,away_cards",
    )
    .eq("round_id", matchday);

  const teamConceded = new Map<string, number>();
  const teamScored = new Map<string, number>();
  const teamPlayed = new Set<string>();

  for (const m of matches ?? []) {
    const home = m.home_code as string;
    const away = m.away_code as string;
    const hs = m.home_score as number | null;
    const as = m.away_score as number | null;
    if (hs == null || as == null) continue;
    teamPlayed.add(home);
    teamPlayed.add(away);
    teamScored.set(home, hs);
    teamScored.set(away, as);
    teamConceded.set(home, as);
    teamConceded.set(away, hs);

    const addPoints = (wcId: number, pts: number, played: boolean) => {
      const row = out.get(wcId);
      if (!row) return;
      row.total_points = (row.total_points ?? 0) + pts;
      if (played) row.minutes = Math.max(row.minutes ?? 0, 90);
    };

    const homeGoals = parseGoals(m.home_goals);
    const awayGoals = parseGoals(m.away_goals);

    for (const g of homeGoals) {
      if (g.fifa_player_id != null) {
        const wcId = fifaToWc.get(g.fifa_player_id);
        if (wcId != null) {
          const pos = metaById.get(wcId)?.position ?? "MID";
          addPoints(wcId, goalPoints(pos), true);
        }
      }
      if (g.fifa_assist_id != null) {
        const wcId = fifaToWc.get(g.fifa_assist_id);
        if (wcId != null) addPoints(wcId, 3, true);
      }
    }
    for (const g of awayGoals) {
      if (g.fifa_player_id != null) {
        const wcId = fifaToWc.get(g.fifa_player_id);
        if (wcId != null) {
          const pos = metaById.get(wcId)?.position ?? "MID";
          addPoints(wcId, goalPoints(pos), true);
        }
      }
      if (g.fifa_assist_id != null) {
        const wcId = fifaToWc.get(g.fifa_assist_id);
        if (wcId != null) addPoints(wcId, 3, true);
      }
    }
  }

  const teamCodeByWcTeamId = new Map<number, string>();
  const { data: wcTeams } = await supa.from("wc_teams").select("id,code");
  for (const t of wcTeams ?? []) {
    teamCodeByWcTeamId.set(t.id as number, t.code as string);
  }

  for (const [, meta] of metaById) {
    const code = teamCodeByWcTeamId.get(meta.wc_team_id);
    if (!code || !teamPlayed.has(code)) continue;

    const conceded = teamConceded.get(code) ?? 99;
    if (conceded === 0) {
      const row = out.get(meta.id);
      if (row) {
        row.total_points = (row.total_points ?? 0) + csPoints(meta.position);
        row.minutes = Math.max(row.minutes ?? 0, 90);
      }
    }
  }

  return out;
}

export function scoreWcMiniSquad(
  pickIds: number[],
  captainId: number,
  viceId: number,
  statsByPlayer: Map<number, GwStatRow>,
) {
  return scoreMiniSquad(pickIds, captainId, viceId, statsByPlayer);
}
