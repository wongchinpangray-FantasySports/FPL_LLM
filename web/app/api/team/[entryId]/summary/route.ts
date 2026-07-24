import { FplAccessError, requireFplEntryAccess } from "@/lib/auth/fpl-access";
import { getServerSupabase } from "@/lib/supabase";
import { fplGet, type FplEntry } from "@/lib/fpl";
import type { CachedTeam } from "@/lib/tools/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(
  _req: Request,
  { params }: { params: { entryId: string } },
) {
  const entryId = Number(params.entryId);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return Response.json({ error: "invalid entry id" }, { status: 400 });
  }

  try {
    await requireFplEntryAccess(entryId);
  } catch (err) {
    const status = err instanceof FplAccessError ? err.status : 403;
    return Response.json({ error: (err as Error).message }, { status });
  }

  try {
    const supa = getServerSupabase();
    const { data: cached } = await supa
      .from("user_teams")
      .select("raw,fetched_at")
      .eq("entry_id", entryId)
      .maybeSingle();

    if (cached?.raw && cached.fetched_at) {
      const age = Date.now() - new Date(String(cached.fetched_at)).getTime();
      if (age < CACHE_TTL_MS) {
        const team = cached.raw as CachedTeam;
        return Response.json({
          entry: team.entry,
          picks_gw: team.picks_gw,
          current_gw: team.current_gw,
        });
      }
    }

    const entry = await fplGet<FplEntry>(`/entry/${entryId}/`);
    return Response.json({
      entry: {
        id: entry.id,
        name: entry.name,
        player_first_name: entry.player_first_name,
        player_last_name: entry.player_last_name,
        summary_overall_points: entry.summary_overall_points,
        summary_overall_rank: entry.summary_overall_rank,
        current_event: entry.current_event,
      },
      picks_gw: null,
      current_gw: entry.current_event,
    });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
