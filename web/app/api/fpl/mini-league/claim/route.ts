import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { claimMiniLeagueInvite } from "@/lib/fpl/mini-league/beta";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await req.json()) as { token?: string };
    const token = typeof body.token === "string" ? body.token : "";
    const result = await claimMiniLeagueInvite(user, token);
    if (!result.ok) {
      const status =
        result.error === "missing_table"
          ? 503
          : result.error === "taken" || result.error === "revoked"
            ? 409
            : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true, already: result.already });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to claim invite" },
      { status: 500 },
    );
  }
}
