import { NextResponse } from "next/server";
import { FplAccessError, requireFplEntryAccess } from "@/lib/auth/fpl-access";
import { getAuthUser, getUserProfile } from "@/lib/auth/session";
import { canAccessPremiumFeature, isInsightsPremiumEnforced } from "@/lib/fpl/insights/access";
import { loadMiniLeagueIndex } from "@/lib/fpl/mini-league/load";

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

  if (allowLocalPreview()) {
    const user = await getAuthUser();
    if (user) {
      const profile = await getUserProfile(user.id);
      if (profile?.fpl_entry_id) return profile.fpl_entry_id;
    }
    throw new FplAccessError("Pass ?entry= to preview mini leagues locally.", 403);
  }

  const user = await getAuthUser();
  if (!user) throw new FplAccessError("Unauthorized", 403);
  const profile = await getUserProfile(user.id);
  if (!profile?.fpl_entry_id) {
    throw new FplAccessError("Link your FPL Entry ID in Account settings first.", 403);
  }
  return profile.fpl_entry_id;
}

export async function GET(req: Request) {
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
    const data = await loadMiniLeagueIndex(entryId);
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof FplAccessError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
