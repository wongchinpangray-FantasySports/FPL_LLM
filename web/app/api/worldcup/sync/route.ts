import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { enrichWcPlayerClubs } from "@/lib/wc/club-enrich";
import { ensureWcPlayerPool } from "@/lib/wc/player-pool";
import { ensureWcSeeded } from "@/lib/wc/seed";

export const dynamic = "force-dynamic";

/** Force-refresh WC player pool (FIFA bootstrap first when configured). */
export async function POST() {
  try {
    await ensureWcSeeded();
    const pool = await ensureWcPlayerPool({ force: true });

    let club_enrich = { enriched: 0, skipped: 0 };
    if (pool.source === "fifa") {
      try {
        club_enrich = await enrichWcPlayerClubs(getServerSupabase(), {
          limit: Number(process.env.WC_CLUB_ENRICH_SYNC_LIMIT ?? "60"),
        });
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json({
      pool,
      club_enrich,
      message:
        pool.source === "fifa"
          ? `Synced ${pool.fifa_count} players from FIFA fantasy`
          : pool.fifa_configured
            ? `FIFA sync did not reach minimum pool — ${pool.fifa_last_reason ?? "unknown"}`
            : "FIFA not configured — set FIFA_FANTASY_BOOTSTRAP_PATH on Cloudflare (or fpl_meta).",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
