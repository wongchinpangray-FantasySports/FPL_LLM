import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { ingestScoutArticles } from "@/lib/scout/ingest";
import {
  getScoutArticleById,
  listScoutArticles,
  setScoutArticleStatus,
  setScoutTranslateRequested,
} from "@/lib/scout/store";
import { isScoutStatus } from "@/lib/scout/types";

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
    const body = (await req.json()) as {
      id?: string;
      ids?: string[];
      status?: string;
      translate_requested?: boolean;
    };

    if (typeof body.translate_requested === "boolean") {
      const ids = [
        ...(body.ids ?? []),
        ...(body.id ? [body.id] : []),
      ].filter(Boolean);
      if (!ids.length) {
        return NextResponse.json({ error: "Missing ids" }, { status: 400 });
      }
      const updated = await setScoutTranslateRequested(
        ids,
        body.translate_requested,
      );
      return NextResponse.json({ ok: true, updated });
    }

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
      ids?: string[];
      pages?: number;
      limit?: number;
    };

    if (body.action === "ingest") {
      const result = await ingestScoutArticles({
        pages: body.pages ?? 1,
        limit: body.limit,
        translate: false,
      });
      return NextResponse.json(result);
    }

    if (
      body.action === "request-translate" ||
      body.action === "retranslate"
    ) {
      const ids = [
        ...(body.ids ?? []),
        ...(body.id ? [body.id] : []),
      ].filter(Boolean);
      if (!ids.length) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      if (body.id) {
        const article = await getScoutArticleById(body.id);
        if (!article) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (!article.body_html_en) {
          return NextResponse.json({ error: "No English body" }, { status: 400 });
        }
      }
      const updated = await setScoutTranslateRequested(ids, true);
      return NextResponse.json({ ok: true, updated });
    }

    if (body.action === "cancel-translate") {
      const ids = [
        ...(body.ids ?? []),
        ...(body.id ? [body.id] : []),
      ].filter(Boolean);
      if (!ids.length) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      const updated = await setScoutTranslateRequested(ids, false);
      return NextResponse.json({ ok: true, updated });
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
