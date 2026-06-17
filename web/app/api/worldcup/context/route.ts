import { NextResponse } from "next/server";
import {
  buildWcFdrGrid,
  buildWcScouting,
  buildWcXpRows,
  getWcPoolStatus,
  listWcPlayers,
} from "@/lib/wc/data";
import { ensureWcSeeded } from "@/lib/wc/seed";

export const dynamic = "force-dynamic";

function projectionNote(meta: {
  fixture_scope: string;
  current_matchday: number | null;
  remaining_matchdays: number[];
  finished_matchdays: number[];
}): string | undefined {
  if (meta.fixture_scope !== "remaining") return undefined;
  const md = meta.current_matchday;
  const finished = meta.finished_matchdays;
  if (md == null) return "Group stage complete — projections show no remaining fixtures.";
  const done =
    finished.length > 0 ? ` MD${finished.join(", MD")} played.` : "";
  return `Projections cover remaining group fixtures (from MD${md}).${done}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const position = url.searchParams.get("position") ?? "ALL";
    const scoutingOnly = url.searchParams.get("scouting") === "1";

    await ensureWcSeeded();

    if (scoutingOnly) {
      const { report, projection } = await buildWcScouting();
      return NextResponse.json({
        scouting: report,
        projection,
        projection_note: projectionNote(projection),
        disclaimer:
          "Gem scores blend projected remaining group xP, FIFA % selected, and price. Tournament stats from FIFA fantasy when available. Excludes Premier League club players (FPL-linked) and spotlight clubs (Real Madrid, Barcelona, Bayern, PSG).",
      });
    }

    const [fdrGrid, xp, players, pool] = await Promise.all([
      buildWcFdrGrid(),
      buildWcXpRows(position),
      listWcPlayers(),
      getWcPoolStatus(),
    ]);

    const poolNote =
      pool.source === "fifa"
        ? "Player list synced from FIFA fantasy (final squads)."
        : pool.fifa_configured
          ? `FIFA sync pending: ${pool.fifa_last_reason ?? "check Cloudflare env (FIFA_FANTASY_BOOTSTRAP_PATH + cookie) and redeploy"}. Showing curated fallback — not the full FIFA list.`
          : "Set FIFA_FANTASY_BOOTSTRAP_PATH on Cloudflare for the official FIFA player list.";

    return NextResponse.json({
      fdrGrid,
      xp: { matchdays: xp.matchdays, rows: xp.rows },
      projection: xp.projection,
      projection_note: projectionNote(xp.projection),
      players,
      player_count: players.length,
      pool,
      pool_note: poolNote,
      disclaimer:
        "Projected FDR and xP use FALEAGUE team-strength model with FIFA tournament stats where available — not official FIFA scoring.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load World Cup data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
