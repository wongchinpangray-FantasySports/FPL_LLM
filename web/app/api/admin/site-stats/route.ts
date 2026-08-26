import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { loadSiteActivityStats } from "@/lib/analytics/stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
    const raw = Number(req.nextUrl.searchParams.get("days") ?? "30");
    const days = raw === 7 || raw === 90 ? raw : 30;
    const stats = await loadSiteActivityStats({ days });
    return NextResponse.json({ stats });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    const message = e instanceof Error ? e.message : "Failed to load site stats";
    return NextResponse.json({ error: message }, { status });
  }
}
