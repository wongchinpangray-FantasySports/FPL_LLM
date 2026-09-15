import { NextResponse, type NextRequest } from "next/server";
import { founderPackIsPublic } from "@/lib/billing/founder-pack";
import {
  buildProTeaser,
  isMissingFplEntry,
  parseTeaserEntryId,
  type TeaserLocale,
} from "@/lib/billing/pro-teaser";
import { getClientIp, getNamedRateLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function parseLocale(raw: string | null): TeaserLocale {
  return raw === "en" ? "en" : "zh";
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
    return NextResponse.json({ teaser });
  } catch (e) {
    if (isMissingFplEntry(e)) {
      return NextResponse.json(
        { error: "Entry ID not found on Fantasy Premier League." },
        { status: 404 },
      );
    }
    const message = e instanceof Error ? e.message : "Teaser failed";
    const status = /No squad picks/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
