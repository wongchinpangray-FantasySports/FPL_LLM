import { NextResponse } from "next/server";
import { EMPTY_HOME_HUB, loadHomeHubDataLiteCached } from "@/lib/home/hub-data";
import { readLocaleFromRequest } from "@/lib/wc/localize-players";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const locale = readLocaleFromRequest(req);
    const data = await loadHomeHubDataLiteCached(locale);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=90, stale-while-revalidate=180",
      },
    });
  } catch {
    // Empty 200 — a 5xx retry storm from the homepage was 1102'ing the isolate.
    return NextResponse.json(EMPTY_HOME_HUB, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
      },
    });
  }
}
