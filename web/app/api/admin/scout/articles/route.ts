import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { ingestScoutArticles } from "@/lib/scout/ingest";
import {
  getScoutArticleById,
  listScoutArticles,
  setScoutArticleStatus,
} from "@/lib/scout/store";
import { isScoutStatus } from "@/lib/scout/types";
import { translateScoutArticle } from "@/lib/scout/translate";
import { getServerSupabase } from "@/lib/supabase";
import { excerptFromHtml, sanitizeScoutHtml } from "@/lib/scout/html";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
    const status = req.nextUrl.searchParams.get("status") ?? "all";
    const items = await listScoutArticles({
      status: isScoutStatus(status) ? status : "all",
      limit: 200,
    });
    return NextResponse.json({ items, total: items.length });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    const message = e instanceof Error ? e.message : "Failed to load articles";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdminUser();
    const body = (await req.json()) as { id?: string; status?: string };
    if (!body.id || !body.status || !isScoutStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const article = await setScoutArticleStatus(body.id, body.status);
    if (!article) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ article });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    const message = e instanceof Error ? e.message : "Failed to update article";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminUser();
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      id?: string;
      pages?: number;
      limit?: number;
    };

    if (body.action === "ingest") {
      const result = await ingestScoutArticles({
        pages: body.pages ?? 1,
        limit: body.limit,
      });
      return NextResponse.json(result);
    }

    if (body.action === "retranslate") {
      if (!body.id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      const article = await getScoutArticleById(body.id);
      if (!article?.body_html_en) {
        return NextResponse.json({ error: "No English body" }, { status: 400 });
      }
      const { html } = sanitizeScoutHtml(article.body_html_en, {
        baseUrl: article.source_url,
      });
      const zh = await translateScoutArticle({
        title_en: article.title_en,
        excerpt_en: article.excerpt_en ?? "",
        body_html_en: html,
      });
      const now = new Date().toISOString();
      const supa = getServerSupabase();
      const { error } = await supa
        .from("scout_articles")
        .update({
          title_zh: zh.title_zh,
          excerpt_zh: zh.excerpt_zh || excerptFromHtml(zh.body_html_zh),
          body_html_zh: zh.body_html_zh,
          translation_model: zh.model,
          translation_error: null,
          translated_at: now,
          updated_at: now,
        })
        .eq("id", article.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status });
  }
}
