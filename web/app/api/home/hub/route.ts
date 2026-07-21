import { NextResponse } from "next/server";
import { loadHomeHubDataLiteCached } from "@/lib/home/hub-data";
import { readLocaleFromRequest } from "@/lib/wc/localize-players";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const locale = readLocaleFromRequest(req);
    const data = await loadHomeHubDataLiteCached(locale);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=90, stale-while-revalidate=180",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load hub";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
