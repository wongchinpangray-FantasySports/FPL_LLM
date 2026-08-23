import { NextResponse } from "next/server";
import { authorizeContestRequest } from "@/lib/contest/auth";
import { ContestHttpError, decideContestGw } from "@/lib/contest/decide";
import { CONTEST_ALGORITHM_VERSION } from "@/lib/contest/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Transfer search can project a large candidate pool. */
export const maxDuration = 60;

/**
 * Contest organizer API — one GW decision.
 *
 *   POST /api/contest/v1/decide
 *   Authorization: Bearer <CONTEST_API_KEY>
 *
 * Body: { gw, bank, freeTransfers, chipsRemaining?, squad[15], horizon?, … }
 * Returns: transfers, startingXi, benchOrder, captain, vice, chip, rationale
 */
export async function POST(req: Request) {
  const auth = authorizeContestRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const decision = await decideContestGw(body);
    return NextResponse.json(decision);
  } catch (e) {
    if (e instanceof ContestHttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[contest/v1/decide]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Decide failed." },
      { status: 500 },
    );
  }
}

/** Health / contract discovery (still requires API key). */
export async function GET(req: Request) {
  const auth = authorizeContestRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  return NextResponse.json({
    ok: true,
    algorithmVersion: CONTEST_ALGORITHM_VERSION,
    endpoint: "POST /api/contest/v1/decide",
    docs: {
      body: {
        gw: "1-38",
        bank: "£m",
        freeTransfers: "0-5",
        chipsRemaining: ["wildcard", "freehit", "bboost", "3xc"],
        squad: "15 × { fpl_id, sell_price? }",
        horizon: "1-8 (default 5)",
        allowHits: "boolean (default false)",
        autoPlayChips: "boolean (default false) — set true to auto-return 3xc/bboost",
        riskMode: "neutral | chase | protect",
      },
    },
  });
}
