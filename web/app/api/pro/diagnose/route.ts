import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  DIAGNOSE_CTA_PATH,
  FOUNDER_PACK_PATH,
  type ProSampleSku,
} from "@/lib/billing/founder-pack";
import {
  insertSiteEvent,
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

function parseSku(raw: string | null): ProSampleSku {
  if (raw === "a" || raw === "b") return raw;
  return "b";
}

/**
 * Track 「诊断」 CTA from the public sample, then send them to the Entry teaser.
 *   /api/pro/diagnose?sku=a|b
 */
export async function GET(req: NextRequest) {
  const sku = parseSku(req.nextUrl.searchParams.get("sku"));
  const dest = new URL(
    `/zh${FOUNDER_PACK_PATH}?from=sample&sku=${sku}#teaser`,
    req.url,
  );
  const visitor = visitorIdFrom(req);

  try {
    const limiter = getNamedRateLimiter({
      prefix: "fpl-llm/pro-diagnose",
      limit: 30,
      window: "1 m",
    });
    if (limiter) {
      const ip = getClientIp(req);
      const { success } = await limiter.limit(`${visitor}:${ip}`);
      if (!success) {
        const res = NextResponse.redirect(dest, 302);
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

    await insertSiteEvent({
      event_type: "pro_sample",
      path: DIAGNOSE_CTA_PATH,
      feature: "pro",
      visitor_id: visitor,
      user_id: userId,
      referrer: req.headers.get("referer"),
    });
  } catch {
    /* still send them to the teaser */
  }

  const res = NextResponse.redirect(dest, 302);
  res.cookies.set(SITE_VISITOR_COOKIE, visitor, {
    path: "/",
    maxAge: SITE_VISITOR_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
