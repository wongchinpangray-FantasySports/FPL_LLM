import { NextResponse } from "next/server";
import { FplAccessError, requireFplEntryAccess } from "@/lib/auth/fpl-access";
import { diagnoseSquadTransfers } from "@/lib/transfers/diagnose";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function allowLocalPreview(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_LOCAL_DASHBOARD_PREVIEW === "1"
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      entryId?: number | string;
      horizon?: number;
      refresh?: boolean;
    };
    const entryId = Number(body.entryId);
    if (!Number.isFinite(entryId) || entryId <= 0) {
      return NextResponse.json({ error: "Invalid entryId" }, { status: 400 });
    }

    if (!allowLocalPreview()) {
      await requireFplEntryAccess(entryId);
    }

    const data = await diagnoseSquadTransfers({
      entryId,
      horizon: Number(body.horizon) > 0 ? Number(body.horizon) : 3,
      forceRefresh: body.refresh === true,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof FplAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message =
      e instanceof Error ? e.message : "Transfer diagnosis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
