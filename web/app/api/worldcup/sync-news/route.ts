import { NextResponse } from "next/server";
import { syncWcNews } from "@/lib/wc/news-store";

export const dynamic = "force-dynamic";

/** Refresh World Cup news RSS cache in Supabase. */
export async function POST() {
  try {
    const result = await syncWcNews();
    return NextResponse.json({
      ...result,
      hint: "Run on a schedule (GitHub Actions) — Cloudflare Workers often cannot fetch Google News RSS directly.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "News sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
