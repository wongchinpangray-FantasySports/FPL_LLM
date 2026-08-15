import { NextResponse } from "next/server";
import { loadLastSeasonPointsForPlayers } from "@/lib/squad-builder/last-season-points";
import {
  filterOfficialFplPlayers,
  getOfficialFplBrowsePlayers,
  type SquadBuilderPlayerSort,
} from "@/lib/squad-builder/fpl-live-players";
import {
  minPlayerQueryLength,
  sanitizePlayerQuery,
} from "@/lib/fpl/player-search";

/** Browse players from official FPL bootstrap-static (prices, ownership, form, season pts). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q") ?? "";
  const locale = searchParams.get("locale") ?? "";
  const position = searchParams.get("position");
  const teamIdRaw = searchParams.get("team_id");
  const sort = (searchParams.get("sort") ?? "price") as SquadBuilderPlayerSort;
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 50) || 50, 10),
    400,
  );
  const maxPriceRaw = searchParams.get("max_price");
  const maxPrice =
    maxPriceRaw != null && maxPriceRaw !== "" && Number.isFinite(Number(maxPriceRaw))
      ? Number(maxPriceRaw)
      : undefined;

  const q = sanitizePlayerQuery(raw);
  const teamId =
    teamIdRaw != null && teamIdRaw !== "" && Number.isFinite(Number(teamIdRaw))
      ? Number(teamIdRaw)
      : undefined;

  try {
    const pool = await getOfficialFplBrowsePlayers();
    const { players: filtered, total } = filterOfficialFplPlayers(pool, {
      q: q.length >= minPlayerQueryLength(q) ? q : "",
      locale,
      position:
        position && ["GKP", "DEF", "MID", "FWD"].includes(position)
          ? position
          : undefined,
      teamId,
      maxPrice,
      sort: ["price", "points", "ownership", "form"].includes(sort)
        ? sort
        : "price",
      limit,
    });

    const fplIds = filtered.map((p) => p.fpl_id);
    const codeByFplId = new Map<number, number>();
    for (const p of filtered) {
      if (p.code != null && p.code > 0) codeByFplId.set(p.fpl_id, p.code);
    }
    const { season: lastSeasonKey, points: lastSeasonMap } =
      await loadLastSeasonPointsForPlayers(fplIds, codeByFplId);

    const players = filtered.map((p) => ({
      ...p,
      last_season_points: lastSeasonMap.get(p.fpl_id) ?? null,
    }));

    return NextResponse.json(
      {
        players,
        total,
        lastSeasonKey,
        source: "fpl_bootstrap_static",
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load official FPL players";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
