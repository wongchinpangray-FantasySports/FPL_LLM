import { NextResponse } from "next/server";
import { listPublishedScoutArticles } from "@/lib/scout/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listPublishedScoutArticles(60);
    return NextResponse.json({
      items,
      total: items.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load Scout articles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
