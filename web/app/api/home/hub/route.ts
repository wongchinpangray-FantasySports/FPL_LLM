import { NextResponse } from "next/server";
import { loadHomeHubData } from "@/lib/home/hub-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await loadHomeHubData();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load hub";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
