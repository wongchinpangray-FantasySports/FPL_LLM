import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { nudgeSampleOpenersInbox } from "@/lib/billing/pro-sample-funnel";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireAdminUser();
    const result = await nudgeSampleOpenersInbox();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send inbox" },
      { status },
    );
  }
}
