import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { computeHomeBestXiShowcase } from "@/lib/home/best-xi-showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const getCachedHomeBestXi = unstable_cache(
  computeHomeBestXiShowcase,
  ["home-best-xi-v2"],
  { revalidate: 600 },
);

export async function GET() {
  try {
    const bestXi = await getCachedHomeBestXi();
    return NextResponse.json(
      { bestXi },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Best XI failed";
    return NextResponse.json({ error: message, bestXi: null }, { status: 500 });
  }
}
