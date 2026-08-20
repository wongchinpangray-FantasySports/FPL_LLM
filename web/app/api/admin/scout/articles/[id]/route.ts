import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { getScoutArticleById } from "@/lib/scout/store";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Props) {
  try {
    await requireAdminUser();
    const article = await getScoutArticleById(params.id);
    if (!article) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { article },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status });
  }
}
