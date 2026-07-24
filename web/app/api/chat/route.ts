import type { Content, FunctionCall, Part, GoogleGenAI } from "@google/genai";
import {
  DEFAULT_MODEL,
  SYSTEM_PROMPT,
  getGenAI,
  toolsToFunctionDeclarations,
  userFacingGeminiError,
} from "@/lib/llm";
import { ALL_TOOLS, findTool } from "@/lib/tools";
import type { ToolContext } from "@/lib/tools";
import { getClientIp, getRateLimiter } from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth/session";
import { FplAccessError, requireFplEntryAccess } from "@/lib/auth/fpl-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Prefer US East so Gemini sees a supported egress region (helps CN/EU users when the host defaults elsewhere). */
export const preferredRegion = "iad1";

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  entryId?: string | null;
  /** UI locale (e.g. zh) — affects reply language only, not data source */
  locale?: string | null;
}

const MAX_TOOL_ITERATIONS = 6;

/** Safe JSON for SSE lines (handles BigInt; avoids throw on odd tool payloads). */
function jsonForSse(payload: unknown): string {
  return JSON.stringify(payload, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response("messages[] required", { status: 400 });
  }

  const supa = createSupabaseServerClient();
  const { data: authData, error: authError } = await supa.auth.getUser();
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const profile = await getUserProfile(authData.user.id);
  const linkedEntry = profile?.fpl_entry_id ?? null;
  const requestedEntry = body.entryId?.trim() || null;
  const entryIdStr =
    requestedEntry ?? (linkedEntry != null ? String(linkedEntry) : null);

  if (!entryIdStr) {
    return new Response(
      JSON.stringify({
        error: "Link your FPL Entry ID in Account settings to use chat with your squad.",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const entryIdNum = Number(entryIdStr);
  if (!Number.isFinite(entryIdNum) || entryIdNum <= 0) {
    return new Response(JSON.stringify({ error: "Invalid Entry ID" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    await requireFplEntryAccess(entryIdNum);
  } catch (err) {
    const status = err instanceof FplAccessError ? err.status : 403;
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  try {
  const limiter = getRateLimiter();
  if (limiter) {
    try {
      const ip = getClientIp(req);
      const { success, reset } = await limiter.limit(ip);
      if (!success) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Try again in a moment.",
            resetAt: reset,
          }),
          { status: 429, headers: { "content-type": "application/json" } },
        );
      }
    } catch (err) {
      console.error("[api/chat] rate limiter error — continuing without limit", err);
    }
  }

  const ctx: ToolContext = {
    entryId: entryIdStr,
    userId: authData.user.id,
  };

  let ai: GoogleGenAI;
  try {
    ai = await getGenAI();
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "AI is not configured. Set GEMINI_API_KEY in the server environment.";
    return new Response(JSON.stringify({ error: message }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  let contents: Content[];
  let functionDeclarations: ReturnType<typeof toolsToFunctionDeclarations>;
  try {
    // Convert chat history into Gemini `Content[]`. Gemini uses "user" /
    // "model" (not "assistant") and strings are wrapped in a text Part.
    contents = body.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    functionDeclarations = toolsToFunctionDeclarations(ALL_TOOLS);
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "Failed to prepare request for the AI";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        let line: string;
        try {
          line = jsonForSse(event);
        } catch (e) {
          console.error("[api/chat] SSE serialize failed", e);
          line = jsonForSse({
            type: "error",
            message: "Stream encoding failed for this response.",
          });
        }
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      };

      try {
        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          const modelParts: Part[] = [];
          const functionCalls: FunctionCall[] = [];

          const locale = body.locale?.trim().toLowerCase();
          const localeReplyHint =
            locale === "zh"
              ? `\n\nUI locale: Chinese (中文). Reply in 中文 unless the user clearly writes in English.`
              : "";

          const streamResp = await ai.models.generateContentStream({
            model: DEFAULT_MODEL,
            contents,
            config: {
              systemInstruction: SYSTEM_PROMPT + localeReplyHint,
              tools: [{ functionDeclarations }],
              temperature: 0.4,
            },
          });

          for await (const chunk of streamResp) {
            const parts = chunk.candidates?.[0]?.content?.parts ?? [];
            for (const part of parts) {
              if (typeof part.text === "string" && part.text.length > 0) {
                modelParts.push({ text: part.text });
                send({ type: "text", delta: part.text });
              } else if (part.functionCall) {
                modelParts.push({ functionCall: part.functionCall });
                functionCalls.push(part.functionCall);
                send({
                  type: "tool_use",
                  name: part.functionCall.name,
                  input: part.functionCall.args ?? {},
                });
              }
            }
          }

          if (modelParts.length > 0) {
            contents.push({ role: "model", parts: modelParts });
          }

          if (functionCalls.length === 0) {
            break;
          }

          const responseParts: Part[] = [];
          for (const call of functionCalls) {
            const name = call.name ?? "";
            const handler = findTool(name);
            if (!handler) {
              responseParts.push({
                functionResponse: {
                  name,
                  response: {
                    error: `No handler registered for tool '${name}'.`,
                  },
                },
              });
              continue;
            }
            try {
              const result = await handler.run(
                (call.args ?? {}) as Record<string, unknown>,
                ctx,
              );
              // Gemini requires `response` to be an object; if the tool
              // returned an array or primitive, wrap it.
              const responseObj =
                result !== null &&
                typeof result === "object" &&
                !Array.isArray(result)
                  ? (result as Record<string, unknown>)
                  : { result };
              responseParts.push({
                functionResponse: { name, response: responseObj },
              });
            } catch (err) {
              responseParts.push({
                functionResponse: {
                  name,
                  response: {
                    error: `Tool '${name}' failed: ${(err as Error).message}`,
                  },
                },
              });
            }
          }

          contents.push({ role: "user", parts: responseParts });
        }

        send({ type: "done" });
      } catch (err) {
        send({ type: "error", message: userFacingGeminiError(err, body.locale) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
  } catch (e) {
    console.error("[api/chat] unhandled", e);
    const message = e instanceof Error ? e.message : "Server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
