import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFootballDataClub } from "@/lib/wc/football-data-club";
import { fetchWikidataClub } from "@/lib/wc/wikidata-club";

const DELAY_MS = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function enrichWcPlayerClubs(
  supa: SupabaseClient,
  opts?: { limit?: number },
): Promise<{ enriched: number; skipped: number }> {
  const limit = opts?.limit ?? 80;

  const { data: rows, error } = await supa
    .from("wc_players")
    .select("id,name,wc_teams(code),season_club")
    .is("season_club", null)
    .is("club_source", null)
    .eq("source", "fifa")
    .order("id")
    .limit(limit);

  if (error) throw new Error(error.message);

  let enriched = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const teamRaw = row.wc_teams as { code: string } | { code: string }[] | null;
    const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;
    const nationCode = team?.code;
    const name = row.name as string;

    let club: string | null = null;
    let league: string | null = null;
    let source: string | null = null;

    const fd = await fetchFootballDataClub(name);
    if (fd) {
      club = fd.club;
      league = fd.league;
      source = "football-data";
    } else {
      let wd = await fetchWikidataClub(name, nationCode);
      if (!wd && name.includes(" ")) {
        const last = name.trim().split(/\s+/).pop();
        if (last && last.length > 2) {
          wd = await fetchWikidataClub(last, nationCode);
        }
      }
      if (wd) {
        club = wd.club;
        league = wd.league;
        source = "wikidata";
      }
    }

    if (!club) {
      await supa
        .from("wc_players")
        .update({ club_source: "unresolved" })
        .eq("id", row.id as number);
      skipped++;
      await sleep(DELAY_MS);
      continue;
    }

    const { error: upErr } = await supa
      .from("wc_players")
      .update({
        season_club: club,
        season_league: league,
        club_source: source,
      })
      .eq("id", row.id as number);

    if (!upErr) enriched++;
    else skipped++;

    await sleep(DELAY_MS);
  }

  return { enriched, skipped };
}
