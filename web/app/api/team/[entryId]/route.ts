import { fetchAndCacheTeam } from "@/lib/tools/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { entryId: string } },
) {
  const entryId = Number(params.entryId);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return new Response(
      JSON.stringify({ error: "invalid entry id" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  try {
    const team = await fetchAndCacheTeam(entryId);
    return new Response(JSON.stringify(team), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
