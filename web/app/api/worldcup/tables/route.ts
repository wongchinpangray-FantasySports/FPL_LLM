import { NextResponse } from "next/server";
import { ensureWcSeeded } from "@/lib/wc/seed";
import { loadWcTablesData } from "@/lib/wc/standings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureWcSeeded();
    const data = await loadWcTablesData();
    return NextResponse.json({
      ...data,
      disclaimer:
        "Group tables from finished group-stage fixtures (scores synced from FIFA when available). Player goals/assists from the World Cup fantasy pool.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load tables";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
