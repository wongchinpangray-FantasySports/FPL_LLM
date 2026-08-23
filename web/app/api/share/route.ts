import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { inferShareKind, normalizeSharePath } from "@/lib/share/codes";
import { upsertShareLink } from "@/lib/share/store";
import { sharePublicOrigin } from "@/lib/share/origin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    path?: string;
    title?: string;
    ref_id?: string;
  } | null;

  const target = normalizeSharePath(String(body?.path ?? ""));
  if (!target) {
    return NextResponse.json({ error: "Unsupported share path" }, { status: 400 });
  }
  const kind = inferShareKind(target);
  if (!kind) {
    return NextResponse.json({ error: "Unsupported share path" }, { status: 400 });
  }

  const user = await getAuthUser();
  const title = String(body?.title ?? "").trim().slice(0, 160);
  const refId = body?.ref_id ? String(body.ref_id).slice(0, 120) : null;

  try {
    const link = await upsertShareLink({
      kind,
      target_path: target,
      title,
      ref_id: refId,
      created_by: user?.id ?? null,
    });
    const url = `${sharePublicOrigin(req)}/s/${link.code}`;
    return NextResponse.json({
      code: link.code,
      url,
      kind: link.kind,
      path: link.target_path,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create share link";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
