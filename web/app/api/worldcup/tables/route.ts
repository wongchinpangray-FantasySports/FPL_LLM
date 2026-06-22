import { NextResponse } from "next/server";
import { loadWcTablesDataCached } from "@/lib/wc/standings";
import { readLocaleFromRequest } from "@/lib/wc/localize-players";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const locale = readLocaleFromRequest(req);
    const data = await loadWcTablesDataCached(locale);
    return NextResponse.json(
      {
        ...data,
        disclaimer:
          "Group tables and leaderboards from live FIFA match results (scores and goal scorers).",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=90, stale-while-revalidate=180",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load tables";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
