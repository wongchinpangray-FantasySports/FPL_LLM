import { NextResponse } from "next/server";
import { computeHomeBestXiShowcase } from "@/lib/home/best-xi-showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const bestXi = await computeHomeBestXiShowcase();
    return NextResponse.json({ bestXi });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Best XI failed";
    return NextResponse.json({ error: message, bestXi: null }, { status: 500 });
  }
}
