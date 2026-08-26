import { NextResponse } from "next/server";
import { loadWhatsNew } from "@/lib/home/whats-new";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await loadWhatsNew();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load what's new";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
