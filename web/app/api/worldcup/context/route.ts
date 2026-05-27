import { NextResponse } from "next/server";
import { buildWcFdrGrid, buildWcXpRows, listWcPlayers } from "@/lib/wc/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const position = url.searchParams.get("position") ?? "ALL";

    const [fdrGrid, xp, players] = await Promise.all([
      buildWcFdrGrid(),
      buildWcXpRows(position),
      listWcPlayers(),
    ]);

    return NextResponse.json({
      fdrGrid,
      xp,
      players,
      disclaimer:
        "Projected FDR and xP use FALEAGUE team-strength model — not official FIFA fantasy data.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load World Cup data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
