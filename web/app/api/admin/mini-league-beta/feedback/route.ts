import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { listMiniLeagueFeedback } from "@/lib/fpl/mini-league/beta";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const { rows, tableMissing } = await listMiniLeagueFeedback();
    return NextResponse.json({ rows, tableMissing });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load feedback" },
      { status },
    );
  }
}
