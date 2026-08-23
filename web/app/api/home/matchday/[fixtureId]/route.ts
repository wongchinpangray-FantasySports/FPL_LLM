import { loadMatchdayDetail } from "@/lib/home/matchday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { fixtureId: string } },
) {
  const fixtureId = Number(params.fixtureId);
  if (!Number.isFinite(fixtureId) || fixtureId <= 0) {
    return Response.json({ error: "invalid fixture id" }, { status: 400 });
  }

  try {
    const data = await loadMatchdayDetail(fixtureId);
    if (!data) {
      return Response.json({ error: "fixture not found" }, { status: 404 });
    }
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load match" },
      { status: 500 },
    );
  }
}
