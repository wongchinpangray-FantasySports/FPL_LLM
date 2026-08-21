import { NextResponse } from "next/server";
import { validateFplEntryExists } from "@/lib/auth/fpl-access";
import { toFplEntryPreview } from "@/lib/fpl/entry-preview";

export const dynamic = "force-dynamic";

/** Public FPL entry lookup — used to confirm team/manager before linking. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("entryId") ?? url.searchParams.get("id");
    const entryId = Number(raw);
    if (!Number.isFinite(entryId) || entryId <= 0) {
      return NextResponse.json(
        { error: "Valid Entry ID required" },
        { status: 400 },
      );
    }

    const entry = await validateFplEntryExists(Math.trunc(entryId));
    return NextResponse.json(
      { preview: toFplEntryPreview(entry) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to look up Entry ID";
    const status = /404|not found/i.test(message) ? 404 : 502;
    return NextResponse.json(
      {
        error:
          status === 404
            ? "Entry ID not found on Fantasy Premier League."
            : message,
      },
      { status },
    );
  }
}
