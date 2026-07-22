import { NextResponse } from "next/server";
import {
  listRecentFplXDigests,
  loadFplXDigestFromDb,
  londonDigestDateIso,
} from "@/lib/fpl/fpl-x-digest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const locale = url.searchParams.get("locale")?.toLowerCase() ?? "en";
    const dateParam = url.searchParams.get("date");
    const digestDate = dateParam ?? londonDigestDateIso();

    const digest = await loadFplXDigestFromDb(digestDate);
    const recent = await listRecentFplXDigests(14);

    if (!digest) {
      return NextResponse.json({
        digest: null,
        digest_date: digestDate,
        recent,
      });
    }

    const summary =
      locale.startsWith("zh") && digest.summary_zh
        ? digest.summary_zh
        : digest.summary_en;

    return NextResponse.json(
      {
        digest: {
          ...digest,
          summary,
        },
        digest_date: digestDate,
        recent,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load FPL daily digest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
