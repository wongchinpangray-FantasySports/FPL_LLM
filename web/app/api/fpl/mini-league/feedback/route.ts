import { NextResponse } from "next/server";
import { getAuthUser, getUserProfile } from "@/lib/auth/session";
import { submitMiniLeagueFeedback } from "@/lib/fpl/mini-league/beta";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await req.json()) as {
      body?: string;
      toolId?: string;
      rating?: number;
    };
    const profile = await getUserProfile(user.id);
    const result = await submitMiniLeagueFeedback({
      user,
      body: typeof body.body === "string" ? body.body : "",
      toolId: typeof body.toolId === "string" ? body.toolId : null,
      rating: typeof body.rating === "number" ? body.rating : null,
      fplEntryId: profile?.fpl_entry_id ?? null,
    });
    if (!result.ok) {
      const status =
        result.error === "forbidden"
          ? 403
          : result.error === "rate_limited"
            ? 429
            : result.error === "missing_table"
              ? 503
              : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send feedback" },
      { status: 500 },
    );
  }
}
