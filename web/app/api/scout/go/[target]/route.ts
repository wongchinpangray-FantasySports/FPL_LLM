import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  eventTypeForGoTarget,
  resolveGoDestination,
} from "@/lib/scout/links";
import {
  getScoutArticleById,
  getScoutArticleBySlug,
  insertScoutEvent,
} from "@/lib/scout/store";
import { isScoutGoTarget } from "@/lib/scout/types";

export const dynamic = "force-dynamic";

const COOKIE = "fl_scout_vid";

type Props = { params: { target: string } };

export async function GET(req: NextRequest, { params }: Props) {
  const target = params.target;
  if (!isScoutGoTarget(target)) {
    return NextResponse.json({ error: "Unknown target" }, { status: 404 });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("article");
  const id = url.searchParams.get("id");

  let article = id ? await getScoutArticleById(id) : null;
  if (!article && slug) {
    article = await getScoutArticleBySlug(slug, { includeUnpublished: true });
  }

  const destination = resolveGoDestination(target, article?.source_url);
  const visitor =
    req.cookies.get(COOKIE)?.value?.trim() || crypto.randomUUID();

  let userId: string | null = null;
  try {
    userId = (await getAuthUser())?.id ?? null;
  } catch {
    userId = null;
  }

  try {
    await insertScoutEvent({
      event_type: eventTypeForGoTarget(target),
      article_id: article?.id ?? null,
      slug: article?.slug ?? slug,
      visitor_id: visitor,
      user_id: userId,
      referrer: req.headers.get("referer"),
      path: url.pathname,
      meta: { target, to: destination },
    });
  } catch {
    /* still redirect */
  }

  const res = NextResponse.redirect(destination, 302);
  res.cookies.set(COOKIE, visitor, {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
  });
  return res;
}
