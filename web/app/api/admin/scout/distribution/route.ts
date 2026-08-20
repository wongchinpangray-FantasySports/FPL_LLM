import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { insertDistributionLog } from "@/lib/scout/store";
import { isScoutChannel } from "@/lib/scout/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdminUser();
    const body = (await req.json()) as {
      channel?: string;
      note?: string;
      article_id?: string;
    };
    if (!body.channel || !isScoutChannel(body.channel)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }
    const row = await insertDistributionLog({
      channel: body.channel,
      note: body.note ?? null,
      article_id: body.article_id ?? null,
      created_by: user.email ?? user.id,
    });
    return NextResponse.json({ log: row });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    const message = e instanceof Error ? e.message : "Failed to log push";
    return NextResponse.json({ error: message }, { status });
  }
}
