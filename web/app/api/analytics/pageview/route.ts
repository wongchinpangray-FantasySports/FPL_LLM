import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  featureFromPath,
  normalizeTrackedPath,
  shouldSkipTracking,
} from "@/lib/analytics/features";
import {
  insertSitePageview,
  isSiteVisitorId,
  SCOUT_VISITOR_COOKIE,
  SITE_VISITOR_COOKIE,
  SITE_VISITOR_COOKIE_MAX_AGE,
} from "@/lib/analytics/store";
import { getClientIp, getNamedRateLimiter } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

function visitorIdFrom(req: NextRequest): string {
  const site = req.cookies.get(SITE_VISITOR_COOKIE)?.value?.trim();
  if (isSiteVisitorId(site)) return site;
  const scout = req.cookies.get(SCOUT_VISITOR_COOKIE)?.value?.trim();
  if (isSiteVisitorId(scout)) return scout;
  return crypto.randomUUID();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { path?: string };
    const path = normalizeTrackedPath(body.path ?? "");
    if (!path || shouldSkipTracking(path)) {
      return new NextResponse(null, { status: 204 });
    }

    const visitor = visitorIdFrom(req);
    const limiter = getNamedRateLimiter({
      prefix: "fpl-llm/site-pageview",
      limit: 40,
      window: "1 m",
    });
    if (limiter) {
      const ip = getClientIp(req);
      const { success } = await limiter.limit(`${visitor}:${ip}`);
      if (!success) {
        const res = NextResponse.json({ ok: true, limited: true });
        res.cookies.set(SITE_VISITOR_COOKIE, visitor, {
          path: "/",
          maxAge: SITE_VISITOR_COOKIE_MAX_AGE,
          sameSite: "lax",
          httpOnly: false,
        });
        return res;
      }
    }

    let userId: string | null = null;
    try {
      const user = await getAuthUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }

    await insertSitePageview({
      path,
      feature: featureFromPath(path),
      visitor_id: visitor,
      user_id: userId,
      referrer: req.headers.get("referer"),
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SITE_VISITOR_COOKIE, visitor, {
      path: "/",
      maxAge: SITE_VISITOR_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false });
  }
}
