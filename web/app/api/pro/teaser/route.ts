import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { founderPackIsPublic, teaserLookupPath } from "@/lib/billing/founder-pack";
import {
  buildPreviewProTeaser,
  buildProTeaser,
  isMissingFplEntry,
  parseTeaserEntryId,
  type TeaserLocale,
} from "@/lib/billing/pro-teaser";
import { getClientIp, getNamedRateLimiter } from "@/lib/ratelimit";
import {
  insertSiteEvent,
  isSiteVisitorId,
  SCOUT_VISITOR_COOKIE,
  SITE_VISITOR_COOKIE,
} from "@/lib/analytics/store";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function parseLocale(raw: string | null): TeaserLocale {
  return raw === "en" ? "en" : "zh";
}

/** Local-only fixture so the 3-problem copy can be reviewed when FPL is 503. */
export async function GET(req: NextRequest) {
  try {
    if (!founderPackIsPublic()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const preview = req.nextUrl.searchParams.get("preview");
    if (preview !== "1" && preview !== "teaser") {
      return NextResponse.json({ error: "Use POST" }, { status: 405 });
    }
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const locale = parseLocale(req.nextUrl.searchParams.get("locale"));
    return NextResponse.json({ teaser: buildPreviewProTeaser(locale) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Teaser failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!founderPackIsPublic()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const limiter = getNamedRateLimiter({
      prefix: "fpl-llm/pro-teaser",
      limit: 12,
      window: "1 m",
    });
    if (limiter) {
      const ip = getClientIp(req);
      const { success } = await limiter.limit(ip);
      if (!success) {
        return NextResponse.json(
          { error: "Too many teaser requests" },
          { status: 429 },
        );
      }
    }

    const body = (await req.json().catch(() => ({}))) as {
      entryId?: unknown;
      locale?: unknown;
    };
    const entryId = parseTeaserEntryId(body.entryId);
    if (entryId == null) {
      return NextResponse.json({ error: "Valid Entry ID required" }, { status: 400 });
    }
    const locale = parseLocale(
      typeof body.locale === "string" ? body.locale : req.nextUrl.searchParams.get("locale"),
    );

    const teaser = await buildProTeaser(entryId, locale);
    try {
      const visitor =
        req.cookies.get(SITE_VISITOR_COOKIE)?.value?.trim() ||
        req.cookies.get(SCOUT_VISITOR_COOKIE)?.value?.trim() ||
        null;
      let userId: string | null = null;
      try {
        userId = (await getAuthUser())?.id ?? null;
      } catch {
        userId = null;
      }
      await insertSiteEvent({
        event_type: "pro_sample",
        path: teaserLookupPath(entryId),
        feature: "pro",
        visitor_id: visitor && isSiteVisitorId(visitor) ? visitor : null,
        user_id: userId,
        referrer: req.headers.get("referer"),
      });
    } catch {
      /* still return the teaser */
    }
    return NextResponse.json({ teaser });
  } catch (e) {
    if (isMissingFplEntry(e)) {
      return NextResponse.json(
        { error: "Entry ID not found on Fantasy Premier League." },
        { status: 404 },
      );
    }
    const message = e instanceof Error ? e.message : "Teaser failed";
    if (/-> 50[023]|-> 429|-> 403|timeout/i.test(message)) {
      return NextResponse.json(
        { error: "FPL is busy. Try again in a moment." },
        { status: 502 },
      );
    }
    const status = /No squad picks/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
