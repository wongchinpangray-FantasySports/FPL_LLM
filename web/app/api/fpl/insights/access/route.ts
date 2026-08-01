import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { getInsightsAccessSummary, getInsightsSponsor } from "@/lib/fpl/insights/access";

export const dynamic = "force-dynamic";

/** Client-side access check for premium insight gating (optional). */
export async function GET() {
  const user = await getAuthUser();
  const summary = await getInsightsAccessSummary(user?.id);
  const sponsor = getInsightsSponsor();
  return NextResponse.json({
    ...summary,
    sponsor,
  });
}
