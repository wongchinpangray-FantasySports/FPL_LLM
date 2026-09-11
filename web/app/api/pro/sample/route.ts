import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  resolveProSampleAsset,
  type ProSampleFmt,
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

function parseSku(raw: string | null): ProSampleSku | null {
  if (raw === "a" || raw === "b") return raw;
  return null;
}

function parseFmt(raw: string | null): ProSampleFmt | null {
  if (raw === "html" || raw === "pdf") return raw;
  return null;
}

/**
 * Track PRO sample open/download, then redirect to the static asset.
 *   /api/pro/sample?sku=a&fmt=html
 *   /api/pro/sample?sku=b&fmt=pdf
 */
export async function GET(req: NextRequest) {
  const sku = parseSku(req.nextUrl.searchParams.get("sku"));
  const fmt = parseFmt(req.nextUrl.searchParams.get("fmt"));
  if (!sku || !fmt) {
    return NextResponse.json(
      { error: "sku=a|b and fmt=html|pdf required" },
      { status: 400 },
    );
  }

  const assetPath = resolveProSampleAsset(sku, fmt);
  const visitor = visitorIdFrom(req);

  try {
    const limiter = getNamedRateLimiter({
      prefix: "fpl-llm/pro-sample",
      limit: 30,
      window: "1 m",
    });
    if (limiter) {
      const ip = getClientIp(req);
      const { success } = await limiter.limit(`${visitor}:${ip}`);
      if (!success) {
        const res = NextResponse.redirect(new URL(assetPath, req.url), 302);
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
      path: assetPath,
      feature: "pro",
      visitor_id: visitor,
      user_id: userId,
      referrer: req.headers.get("referer"),
    });
  } catch {
    // Still deliver the sample even if logging fails.
  }

  const res = NextResponse.redirect(new URL(assetPath, req.url), 302);
  res.cookies.set(SITE_VISITOR_COOKIE, visitor, {
    path: "/",
    maxAge: SITE_VISITOR_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
