import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 120;
const MAX_CONTENT_LEN = 48_000;

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim(),
  );
}

/** GET /api/chat/history?sessionId=uuid */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
  if (!sessionId || !isUuid(sessionId)) {
    return Response.json({ error: "sessionId (uuid) required" }, { status: 400 });
  }

  try {
    const supa = getServerSupabase();
    const { data: sessionRow } = await supa
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();

    if (!sessionRow) {
      return Response.json({ messages: [] });
    }

    const { data: rows, error } = await supa
      .from("chat_messages")
      .select("role, content, tool_uses")
      .eq("session_id", sessionId)
      .order("idx", { ascending: true });

    if (error) throw error;

    const messages = (rows ?? []).map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.content ?? "",
      ...(r.tool_uses != null
        ? {
            toolUses: r.tool_uses as { name: string; input: unknown }[],
          }
        : {}),
    }));

    return Response.json({ messages });
  } catch (e) {
    console.error("[api/chat/history GET]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to load history" },
      { status: 500 },
    );
  }
}

type IncomingMsg = {
  role: "user" | "assistant";
  content: string;
  toolUses?: { name: string; input: unknown }[];
};

/** POST /api/chat/history — replace thread for session */
export async function POST(req: Request) {
  let body: {
    sessionId?: string;
    entryId?: number | null;
    locale?: string | null;
    messages?: IncomingMsg[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim() ?? "";
  if (!sessionId || !isUuid(sessionId)) {
    return Response.json({ error: "sessionId (uuid) required" }, { status: 400 });
  }

  const raw = body.messages;
  if (!Array.isArray(raw)) {
    return Response.json({ error: "messages[] required" }, { status: 400 });
  }

  const messages = raw.slice(-MAX_MESSAGES);
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") {
      return Response.json({ error: "invalid message role" }, { status: 400 });
    }
    const c = typeof m.content === "string" ? m.content : "";
    if (c.length > MAX_CONTENT_LEN) {
      return Response.json({ error: "message too long" }, { status: 400 });
    }
  }

  try {
    const supa = getServerSupabase();
    const entryId =
      typeof body.entryId === "number" && Number.isFinite(body.entryId)
        ? Math.trunc(body.entryId)
        : null;
    const locale =
      typeof body.locale === "string" ? body.locale.slice(0, 16) : null;

    const { error: upErr } = await supa.from("chat_sessions").upsert(
      {
        id: sessionId,
        entry_id: entryId,
        locale,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (upErr) throw upErr;

    const { error: delErr } = await supa
      .from("chat_messages")
      .delete()
      .eq("session_id", sessionId);
    if (delErr) throw delErr;

    if (messages.length === 0) {
      return Response.json({ ok: true });
    }

    const insertRows = messages.map((m, idx) => ({
      session_id: sessionId,
      idx,
      role: m.role,
      content: m.content ?? "",
      tool_uses:
        m.toolUses && m.toolUses.length > 0 ? (m.toolUses as unknown) : null,
    }));

    const { error: insErr } = await supa.from("chat_messages").insert(insertRows);
    if (insErr) throw insErr;

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[api/chat/history POST]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to save history" },
      { status: 500 },
    );
  }
}
