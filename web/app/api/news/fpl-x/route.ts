import { NextResponse } from "next/server";
import {
  listArchivedFplXDigests,
  londonDigestDateIso,
} from "@/lib/fpl/fpl-x-digest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const locale = url.searchParams.get("locale")?.toLowerCase() ?? "en";
    const limit = Math.min(
      60,
      Math.max(5, Number(url.searchParams.get("limit") ?? "30")),
    );
    const today = londonDigestDateIso();

    const days = await listArchivedFplXDigests({
      limit,
      locale,
      beforeDate: today,
    });

    return NextResponse.json(
      {
        days,
        total: days.length,
        today,
        disclaimer:
          "Archived FPL daily briefings — AI summary and sources from each past 24-hour window.",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load FPL archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
