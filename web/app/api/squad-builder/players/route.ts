import { NextResponse } from "next/server";
import { loadLastSeasonPointsForPlayers } from "@/lib/squad-builder/last-season-points";
import {
  filterOfficialFplPlayers,
  getOfficialFplBrowsePlayers,
  type SquadBuilderPlayerSort,
} from "@/lib/squad-builder/fpl-live-players";

function sanitizeQuery(q: string): string {
  return q
    .replace(/%/g, "")
    .replace(/[,*'"`;()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

/** Browse players from official FPL bootstrap-static (prices, ownership, form, season pts). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q") ?? "";
  const position = searchParams.get("position");
  const teamIdRaw = searchParams.get("team_id");
  const sort = (searchParams.get("sort") ?? "price") as SquadBuilderPlayerSort;
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 50) || 50, 10),
    100,
  );

  const q = sanitizeQuery(raw);
  const teamId =
    teamIdRaw != null && teamIdRaw !== "" && Number.isFinite(Number(teamIdRaw))
      ? Number(teamIdRaw)
      : undefined;

  try {
    const pool = await getOfficialFplBrowsePlayers();
    const filtered = filterOfficialFplPlayers(pool, {
      q,
      position:
        position && ["GKP", "DEF", "MID", "FWD"].includes(position)
          ? position
          : undefined,
      teamId,
      sort: ["price", "points", "ownership", "form"].includes(sort)
        ? sort
        : "price",
      limit,
    });

    const fplIds = filtered.map((p) => p.fpl_id);
    const { season: lastSeasonKey, points: lastSeasonMap } =
      await loadLastSeasonPointsForPlayers(fplIds);

    const players = filtered.map((p) => ({
      ...p,
      last_season_points: lastSeasonMap.get(p.fpl_id) ?? null,
    }));

    return NextResponse.json(
      {
        players,
        lastSeasonKey,
        source: "fpl_bootstrap_static",
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load official FPL players";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
