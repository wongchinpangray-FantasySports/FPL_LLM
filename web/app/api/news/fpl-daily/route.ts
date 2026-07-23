import { NextResponse } from "next/server";
import { requireAuthForApi } from "@/lib/auth/require-auth-api";
import {
  loadFplXDigestFromDb,
  londonDigestDateIso,
  pickDigestSummary,
} from "@/lib/fpl/fpl-x-digest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const access = await requireAuthForApi();
    if (access instanceof NextResponse) return access;

    const url = new URL(req.url);
    const locale = url.searchParams.get("locale")?.toLowerCase() ?? "en";
    const dateParam = url.searchParams.get("date");
    const digestDate = dateParam ?? londonDigestDateIso();

    const digest = await loadFplXDigestFromDb(digestDate);

    if (!digest) {
      return NextResponse.json({
        digest: null,
        digest_date: digestDate,
      });
    }

    return NextResponse.json(
      {
        digest: {
          ...digest,
          summary: pickDigestSummary(digest, locale),
        },
        digest_date: digestDate,
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
