import { NextResponse } from "next/server";
import {
  buildWcFdrGrid,
  buildWcXpRows,
  getWcPoolStatus,
  listWcPlayers,
} from "@/lib/wc/data";
import { ensureWcSeeded } from "@/lib/wc/seed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const position = url.searchParams.get("position") ?? "ALL";

    await ensureWcSeeded();

    const [fdrGrid, xp, players, pool] = await Promise.all([
      buildWcFdrGrid(),
      buildWcXpRows(position),
      listWcPlayers(),
      getWcPoolStatus(),
    ]);

    const poolNote =
      pool.source === "fifa"
        ? "Player list synced from FIFA fantasy (provisional squad)."
        : pool.fifa_configured
          ? `FIFA sync pending: ${pool.fifa_last_reason ?? "check Vercel env and redeploy"}. Showing FPL seed fallback.`
          : "Set FIFA_FANTASY_BOOTSTRAP_PATH on Vercel for the official FIFA player list.";

    return NextResponse.json({
      fdrGrid,
      xp,
      players,
      player_count: players.length,
      pool,
      pool_note: poolNote,
      disclaimer:
        "Projected FDR and xP use FALEAGUE team-strength model — not official FIFA scoring.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load World Cup data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
