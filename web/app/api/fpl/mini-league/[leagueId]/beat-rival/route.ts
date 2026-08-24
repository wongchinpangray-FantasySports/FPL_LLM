import { NextResponse } from "next/server";
import { FplAccessError, requireFplEntryAccess } from "@/lib/auth/fpl-access";
import { getAuthUser, getUserProfile } from "@/lib/auth/session";
import { canAccessPremiumFeature, isInsightsPremiumEnforced } from "@/lib/fpl/insights/access";
import { loadBeatRival } from "@/lib/fpl/mini-league/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowLocalPreview(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_LOCAL_DASHBOARD_PREVIEW === "1"
  );
}

async function resolveEntryId(req: Request): Promise<number> {
  const url = new URL(req.url);
  const raw = url.searchParams.get("entry");
  if (raw && /^\d+$/.test(raw)) {
    const entryId = Number(raw);
    if (!allowLocalPreview()) {
      await requireFplEntryAccess(entryId);
    }
    return entryId;
  }

  const user = await getAuthUser();
  if (user) {
    const profile = await getUserProfile(user.id);
    if (profile?.fpl_entry_id) return profile.fpl_entry_id;
  }
  if (allowLocalPreview()) {
    throw new FplAccessError("Pass ?entry= to preview mini leagues locally.", 403);
  }
  throw new FplAccessError("Link your FPL Entry ID in Account settings first.", 403);
}

export async function GET(
  req: Request,
  { params }: { params: { leagueId: string } },
) {
  const leagueId = Number(params.leagueId);
  if (!Number.isFinite(leagueId) || leagueId <= 0) {
    return NextResponse.json({ error: "invalid league id" }, { status: 400 });
  }

  try {
    const user = await getAuthUser();
    if (!allowLocalPreview() && !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const allowed = await canAccessPremiumFeature(user?.id);
    if (!allowed && isInsightsPremiumEnforced()) {
      return NextResponse.json({ error: "premium_required" }, { status: 402 });
    }
    const entryId = await resolveEntryId(req);
    const url = new URL(req.url);
    const rivalRaw = url.searchParams.get("rival");
    const rivalEntryId = rivalRaw && /^\d+$/.test(rivalRaw) ? Number(rivalRaw) : NaN;
    if (!Number.isFinite(rivalEntryId) || rivalEntryId <= 0) {
      return NextResponse.json({ error: "invalid rival entry" }, { status: 400 });
    }
    if (rivalEntryId === entryId) {
      return NextResponse.json({ error: "pick a rival, not yourself" }, { status: 400 });
    }
    const data = await loadBeatRival(entryId, rivalEntryId);
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof FplAccessError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
