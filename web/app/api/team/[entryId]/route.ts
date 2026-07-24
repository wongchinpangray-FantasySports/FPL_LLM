import { FplAccessError, requireFplEntryAccess } from "@/lib/auth/fpl-access";
import { fetchTeamForUi, teamPayloadForAssistant } from "@/lib/tools/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { entryId: string } },
) {
  const entryId = Number(params.entryId);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return new Response(
      JSON.stringify({ error: "invalid entry id" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  let userId: string;
  try {
    ({ userId } = await requireFplEntryAccess(entryId));
  } catch (err) {
    const status =
      err instanceof FplAccessError ? err.status : 403;
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status, headers: { "content-type": "application/json" } },
    );
  }

  const url = new URL(req.url);
  const forceRefresh =
    url.searchParams.get("refresh") === "1" ||
    url.searchParams.get("refresh") === "true";

  try {
    const team = await fetchTeamForUi(entryId, { forceRefresh, userId });
    return new Response(JSON.stringify(teamPayloadForAssistant(team)), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
