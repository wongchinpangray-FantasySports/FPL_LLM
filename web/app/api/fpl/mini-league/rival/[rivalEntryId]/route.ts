import { NextResponse } from "next/server";
import { FplAccessError, requireFplEntryAccess } from "@/lib/auth/fpl-access";
import { getAuthUser, getUserProfile } from "@/lib/auth/session";
import {
  allowLocalMiniLeaguePreview as allowLocalPreview,
  miniLeagueApiGate,
} from "@/lib/fpl/mini-league/api-guard";
import { loadRivalCompare } from "@/lib/fpl/mini-league/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveYouEntryId(req: Request): Promise<number> {
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
  { params }: { params: { rivalEntryId: string } },
) {
  const rivalEntryId = Number(params.rivalEntryId);
  if (!Number.isFinite(rivalEntryId) || rivalEntryId <= 0) {
    return NextResponse.json({ error: "invalid rival entry" }, { status: 400 });
  }

  try {
    const user = await getAuthUser();
    const denied = await miniLeagueApiGate(user);
    if (denied) return denied;
    const youEntryId = await resolveYouEntryId(req);
    const data = await loadRivalCompare(youEntryId, rivalEntryId);
    return NextResponse.json(data);
  } catch (err) {
    const status = err instanceof FplAccessError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
