import { NextResponse } from "next/server";
import {
  buildWcCompare,
  radarLabelsArray,
  buildWcRadarAxes,
  radarAxesToArray,
} from "@/lib/wc/radar";
import {
  getWcPlayerById,
  loadAllWcPlayers,
} from "@/lib/wc/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const aId = Number(url.searchParams.get("a"));
    const bId = Number(url.searchParams.get("b"));

    if (!Number.isFinite(aId) || aId <= 0) {
      return NextResponse.json({ error: "Missing player id ?a=" }, { status: 400 });
    }

    const pool = await loadAllWcPlayers();
    const playerA = await getWcPlayerById(aId);
    if (!playerA) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    if (!Number.isFinite(bId) || bId <= 0) {
      const axes = buildWcRadarAxes(playerA, pool);
      return NextResponse.json({
        player: {
          id: playerA.id,
          name: playerA.name,
          team_code: playerA.team_code,
          position: playerA.position,
          raw: {
            xg: playerA.xg,
            xa: playerA.xa,
            form: playerA.form,
            goals: playerA.goals,
            assists: playerA.assists,
          },
          values: radarAxesToArray(axes),
        },
        labels: radarLabelsArray(),
      });
    }

    const playerB = await getWcPlayerById(bId);
    if (!playerB) {
      return NextResponse.json({ error: "Compare player not found" }, { status: 404 });
    }

    return NextResponse.json(buildWcCompare(playerA, playerB, pool));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Compare failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
