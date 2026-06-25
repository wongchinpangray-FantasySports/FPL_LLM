import fixturesData from "@/data/epl-2627-fixtures.json";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROMOTED_STRENGTH } from "@/lib/fpl/strength";

type Epl2627Season = {
  teams: { code: string }[];
};

const season = fixturesData as Epl2627Season;

export const EPL_2627_RELEGATED = ["BUR", "WHU", "WOL"] as const;
export const EPL_2627_PROMOTED = ["COV", "HUL", "IPS"] as const;

/** Stable DB ids for promoted clubs until FPL bootstrap assigns official ids. */
export const EPL_2627_PROMOTED_DB_ROWS = [
  { id: 931, name: "Coventry City", short_name: "COV" },
  { id: 932, name: "Hull City", short_name: "HUL" },
  { id: 933, name: "Ipswich Town", short_name: "IPS" },
] as const;

const DISPLAY_NAMES: Record<string, string> = {
  COV: "Coventry City",
  HUL: "Hull City",
  IPS: "Ipswich Town",
};

export type FplClubOption = { id: number; name: string; short_name: string };

export function getEpl2627ClubCodes(): Set<string> {
  return new Set(season.teams.map((t) => t.code));
}

/** Favourite-club picker: 2026/27 PL only — no relegated sides, includes promoted trio. */
export function buildEpl2627ClubOptions(
  dbTeams: FplClubOption[],
): FplClubOption[] {
  const allowed = getEpl2627ClubCodes();
  const relegated = new Set<string>(EPL_2627_RELEGATED);
  const byShort = new Map(
    dbTeams.map((t) => [t.short_name.toUpperCase(), t]),
  );

  const options: FplClubOption[] = [];

  for (const code of allowed) {
    if (relegated.has(code)) continue;

    const hit = byShort.get(code);
    if (hit) {
      options.push({
        ...hit,
        name: DISPLAY_NAMES[code] ?? hit.name,
      });
      continue;
    }

    const promoted = EPL_2627_PROMOTED_DB_ROWS.find((p) => p.short_name === code);
    if (promoted) {
      options.push({ ...promoted });
    }
  }

  return options.sort((a, b) => a.name.localeCompare(b.name));
}

/** Insert promoted clubs when FPL bootstrap still lists relegated sides. */
export async function ensureEpl2627PromotedTeams(
  admin: SupabaseClient,
): Promise<void> {
  for (const row of EPL_2627_PROMOTED_DB_ROWS) {
    const { data: existing } = await admin
      .from("teams")
      .select("id")
      .eq("short_name", row.short_name)
      .maybeSingle();
    if (existing) continue;

    await admin.from("teams").upsert(
      {
        id: row.id,
        name: row.name,
        short_name: row.short_name,
        strength_attack_home: PROMOTED_STRENGTH.attackHome,
        strength_attack_away: PROMOTED_STRENGTH.attackAway,
        strength_defence_home: PROMOTED_STRENGTH.defenceHome,
        strength_defence_away: PROMOTED_STRENGTH.defenceAway,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  }
}

export function fplApiHasStale2627Teams(apiShortNames: string[]): boolean {
  const api = new Set(apiShortNames);
  const hasStale = EPL_2627_RELEGATED.some((c) => api.has(c));
  const missingPromoted = EPL_2627_PROMOTED.some((c) => !api.has(c));
  return hasStale || missingPromoted;
}
