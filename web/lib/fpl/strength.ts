import { getServerSupabase } from "@/lib/supabase";

export const STRENGTH_BASELINE = 1100;

/** Typical promoted-club placeholder when FPL bootstrap has no row yet. */
export const PROMOTED_STRENGTH = {
  attackHome: 1090,
  attackAway: 1090,
  defenceHome: 1080,
  defenceAway: 1080,
};

export type TeamFplStrength = {
  attackHome: number;
  attackAway: number;
  defenceHome: number;
  defenceAway: number;
};

export async function loadTeamStrengthByCode(): Promise<
  Map<string, TeamFplStrength>
> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("teams")
    .select(
      "short_name,strength_attack_home,strength_attack_away,strength_defence_home,strength_defence_away",
    );

  const out = new Map<string, TeamFplStrength>();
  for (const row of data ?? []) {
    const code = String(row.short_name ?? "").trim().toUpperCase();
    if (!code) continue;
    out.set(code, {
      attackHome: num(row.strength_attack_home) || STRENGTH_BASELINE,
      attackAway: num(row.strength_attack_away) || STRENGTH_BASELINE,
      defenceHome: num(row.strength_defence_home) || STRENGTH_BASELINE,
      defenceAway: num(row.strength_defence_away) || STRENGTH_BASELINE,
    });
  }
  return out;
}

export function strengthForCode(
  map: Map<string, TeamFplStrength>,
  code: string,
): TeamFplStrength {
  const hit = map.get(code);
  if (hit) return hit;
  return {
    attackHome: PROMOTED_STRENGTH.attackHome,
    attackAway: PROMOTED_STRENGTH.attackAway,
    defenceHome: PROMOTED_STRENGTH.defenceHome,
    defenceAway: PROMOTED_STRENGTH.defenceAway,
  };
}

/** Higher = leakier defence (easier to score against). Matches xp.ts teamGoalsFor. */
export function defWeaknessFromStrength(
  strength: TeamFplStrength,
  /** Attacking team is home — use opponent away defence rating. */
  home: boolean,
): number {
  const def = home ? strength.defenceAway : strength.defenceHome;
  return STRENGTH_BASELINE / def;
}

export function attackRateFromStrength(
  strength: TeamFplStrength,
  home: boolean,
): number {
  const atk = home ? strength.attackHome : strength.attackAway;
  return atk / STRENGTH_BASELINE;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
