import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { enrichWcPlayerClubs } from "@/lib/wc/club-enrich";
import { ensureWcSeeded } from "@/lib/wc/seed";

export const dynamic = "force-dynamic";

/** Batch-fill domestic clubs (Wikidata). Keep limit low — Cloudflare Workers subrequest cap. */
export async function POST(req: Request) {
  try {
    await ensureWcSeeded();
    const url = new URL(req.url);
    const requested = Number(url.searchParams.get("limit") ?? "5");
    const limit = Math.min(8, Math.max(1, Number.isFinite(requested) ? requested : 5));

    const result = await enrichWcPlayerClubs(getServerSupabase(), { limit });
    return NextResponse.json({
      ...result,
      limit,
      hint: "Call again to enrich more players, or set WC_CLUB_ENRICH_SYNC_LIMIT on sync (max 8).",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Club enrich failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
