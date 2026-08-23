import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getShareByCode, recordShareView } from "@/lib/share/store";
import {
  SHARE_VISITOR_COOKIE,
  isShareVisitorId,
} from "@/lib/share/visitor";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { code: string } },
) {
  const link = await getShareByCode(params.code);
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const visitor = cookies().get(SHARE_VISITOR_COOKIE)?.value;
  if (!isShareVisitorId(visitor)) {
    return NextResponse.json({ error: "Missing visitor" }, { status: 400 });
  }
  const result = await recordShareView(link.id, visitor);
  return NextResponse.json({ result });
}
