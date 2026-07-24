import { NextResponse } from "next/server";
import { requireAuthForApi } from "@/lib/auth/require-auth-api";
import { loadHistoricalPlayerDetail } from "@/lib/fpl/historical-data";

export async function GET(req: Request) {
  const access = await requireAuthForApi();
  if (access instanceof NextResponse) return access;

  const { searchParams } = new URL(req.url);
  const playerId = Number(searchParams.get("playerId"));
  const season = searchParams.get("season") ?? undefined;
  const gwFrom = searchParams.get("gwFrom");
  const gwTo = searchParams.get("gwTo");

  if (!Number.isFinite(playerId) || playerId <= 0) {
    return NextResponse.json({ error: "Invalid playerId" }, { status: 400 });
  }

  try {
    const rosterHint =
      searchParams.get("webName") ||
      searchParams.get("name") ||
      searchParams.get("team")
        ? {
            web_name: searchParams.get("webName") ?? undefined,
            name: searchParams.get("name") ?? undefined,
            team: searchParams.get("team") ?? undefined,
            position: searchParams.get("position") ?? undefined,
          }
        : undefined;

    const detail = await loadHistoricalPlayerDetail(
      Math.floor(playerId),
      season,
      gwFrom != null ? Number(gwFrom) : undefined,
      gwTo != null ? Number(gwTo) : undefined,
      rosterHint,
    );
    if (!detail) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load player";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
