import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { insertScoutEvent } from "@/lib/scout/store";
import { isScoutEventType } from "@/lib/scout/types";

export const dynamic = "force-dynamic";

const COOKIE = "fl_scout_vid";

function visitorIdFrom(req: NextRequest): string {
  const existing = req.cookies.get(COOKIE)?.value?.trim();
  if (existing && existing.length >= 8 && existing.length <= 80) return existing;
  return crypto.randomUUID();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      event_type?: string;
      article_id?: string;
      slug?: string;
      path?: string;
    };
    if (!body.event_type || !isScoutEventType(body.event_type)) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    if (body.event_type !== "pageview") {
      return NextResponse.json({ error: "Use /api/scout/go for clicks" }, { status: 400 });
    }

    const visitor = visitorIdFrom(req);
    let userId: string | null = null;
    try {
      const user = await getAuthUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }

    await insertScoutEvent({
      event_type: "pageview",
      article_id: body.article_id ?? null,
      slug: body.slug ?? null,
      visitor_id: visitor,
      user_id: userId,
      referrer: req.headers.get("referer"),
      path: body.path ?? new URL(req.url).pathname,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, visitor, {
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
      sameSite: "lax",
      httpOnly: false,
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to log event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
