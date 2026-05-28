import { NextResponse } from "next/server";
import { fetchFifaBootstrap } from "@/lib/wc/fifa-sync";
import { ensureWcSeeded } from "@/lib/wc/seed";
import { ensureWcPlayerPool } from "@/lib/wc/player-pool";

export const dynamic = "force-dynamic";

/** Force-refresh WC player pool (FIFA bootstrap first when configured). */
export async function POST() {
  try {
    await ensureWcSeeded();
    const probe = await fetchFifaBootstrap();
    const pool = await ensureWcPlayerPool({ force: true });

    return NextResponse.json({
      pool,
      fifa_debug: probe.debug,
      fetch_error: probe.fetchError ?? null,
      message:
        pool.source === "fifa"
          ? `Synced ${pool.fifa_count} players from FIFA fantasy`
          : pool.fifa_configured
            ? `FIFA sync did not reach minimum pool — ${pool.fifa_last_reason ?? probe.fetchError ?? "unknown"}`
            : "FIFA not configured — set FIFA_FANTASY_BOOTSTRAP_PATH on Cloudflare (or fpl_meta).",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
