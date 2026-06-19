"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useEntryId } from "./entry-id-context";
import { randomUuid } from "@/lib/random-uuid";
import { cn } from "@/lib/utils";

type Role = "user" | "assistant";
interface UiMessage {
  role: Role;
  content: string;
  toolUses?: { name: string; input: unknown }[];
}

const CHAT_SESSION_STORAGE_KEY = "fpl_chat_session_id";

export function Chat() {
  const t = useTranslations("chatUi");
  const locale = useLocale();
  const { entryId } = useEntryId();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      let id = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
      if (!id) {
        id = randomUuid();
        try {
          window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, id);
        } catch {
          /* private mode / quota — keep in-memory session id only */
        }
      }
      setSessionId(id);
    } catch {
      setSessionId(randomUuid());
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`,
        );
        if (!res.ok || cancelled) {
          if (!cancelled) setHydrated(true);
          return;
        }
        const data = (await res.json()) as {
          messages?: Array<{
            role: Role;
            content: string;
            toolUses?: { name: string; input: unknown }[];
          }>;
        };
        const list = data.messages ?? [];
        if (cancelled) return;
        setMessages(
          list.map((m) => ({
            role: m.role,
            content: m.content ?? "",
            ...(m.toolUses?.length ? { toolUses: m.toolUses } : {}),
          })),
        );
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  useEffect(() => {
    if (!sessionId || !hydrated || streaming) return;
    const timer = window.setTimeout(() => {
      const payload = messages.map(({ role, content, toolUses }) => ({
        role,
        content,
        ...(toolUses?.length ? { toolUses } : {}),
      }));
      void fetch("/api/chat/history", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          {
            sessionId,
            entryId:
              entryId && /^\d+$/.test(entryId) ? Number(entryId) : null,
            locale,
            messages: payload,
          },
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
        ),
      }).catch(() => {});
    }, 750);
    return () => window.clearTimeout(timer);
  }, [messages, streaming, sessionId, hydrated, entryId, locale]);

  async function send(content: string) {
    if (!content.trim() || streaming || !hydrated) return;

    const historyForApi = messages
      .filter((m) => m.content)
      .map(({ role, content }) => ({ role, content }));
    const requestMessages = [
      ...historyForApi,
      { role: "user" as const, content },
    ];

    setMessages([
      ...messages,
      { role: "user", content },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          {
            messages: requestMessages,
            entryId,
            locale,
          },
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
        ),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        let message = text || `Request failed (${res.status})`;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j.error) message = j.error;
        } catch {
          /* not JSON */
        }
        throw new Error(message);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (streamErr) {
          const msg =
            streamErr instanceof Error
              ? streamErr.message
              : String(streamErr);
          throw new Error(
            msg.includes("closed") || msg.includes("aborted")
              ? t("streamInterrupted")
              : msg,
          );
        }
        const { done, value } = chunk;
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data:")) continue;
          const payload = part.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload) as {
              type?: string;
              delta?: string;
              name?: string;
              input?: unknown;
              message?: string;
            };
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (!last || last.role !== "assistant") return copy;
              if (evt.type === "text") {
                const d =
                  typeof evt.delta === "string"
                    ? evt.delta
                    : evt.delta != null
                      ? String(evt.delta)
                      : "";
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + d,
                };
              } else if (evt.type === "tool_use" && typeof evt.name === "string") {
                copy[copy.length - 1] = {
                  ...last,
                  toolUses: [
                    ...(last.toolUses ?? []),
                    { name: evt.name, input: evt.input ?? {} },
                  ],
                };
              } else if (evt.type === "error") {
                const msg =
                  typeof evt.message === "string"
                    ? evt.message
                    : evt.message != null
                      ? String(evt.message)
                      : "Unknown error";
                copy[copy.length - 1] = {
                  ...last,
                  content:
                    (last.content ? last.content + "\n\n" : "") +
                    `_Error: ${msg}_`,
                };
              }
              return copy;
            });
          } catch (parseErr) {
            console.warn(
              "[chat] SSE JSON parse failed",
              parseErr,
              payload.slice(0, 160),
            );
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          copy[copy.length - 1] = {
            ...last,
            content: t("sorry", { message: (err as Error).message }),
          };
        }
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex min-h-[min(340px,calc(100vh-14rem))] flex-col sm:min-h-[min(520px,calc(100vh-22rem))] md:min-h-[calc(100vh-20rem)]">
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] sm:rounded-2xl"
      >
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          {!hydrated && (
            <p className="text-xs text-muted-foreground sm:text-sm">{t("loadingHistory")}</p>
          )}
          {hydrated && messages.length === 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-input p-4 text-foreground/70 sm:gap-5 sm:rounded-xl sm:p-5 md:p-6">
              <p className="text-xs leading-relaxed sm:text-sm">
                {t("emptyLead")}
                {entryId ? (
                  <>
                    {" "}
                    {t("emptySquadLinked", { entryId: String(entryId) })}
                  </>
                ) : (
                  <> {t("emptyNoEntry")}</>
                )}
              </p>
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t("examples")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    t("suggestion1"),
                    t("suggestion2"),
                    t("suggestion3"),
                    t("suggestion4"),
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      disabled={streaming || !hydrated}
                      className="rounded-full border border-border bg-muted px-3.5 py-2 text-left text-xs text-foreground/90 transition-colors hover:border-brand-accent/35 hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Message key={i} message={m} />
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-1.5 border-t border-border bg-black/25 p-2.5 sm:gap-2 sm:p-3 md:p-4"
        >
          <Input
            placeholder={t("placeholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming || !hydrated}
            className="flex-1 border-border bg-input"
          />
          <Button type="submit" disabled={streaming || !hydrated || !input.trim()}>
            {streaming ? t("sending") : t("send")}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Message({ message }: { message: UiMessage }) {
  const tc = useTranslations("chatUi");
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <span
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-accent/40 bg-brand-accent/15 text-[10px] font-bold text-brand-accent"
          aria-hidden
        >
          {tc("aiLabel")}
        </span>
      )}
      <div
        className={cn(
          "max-w-[min(88%,560px)] rounded-xl px-3 py-2.5 text-[13px] leading-relaxed shadow-sm sm:max-w-[min(85%,560px)] sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm",
          isUser
            ? "rounded-br-md border border-brand-accent/35 bg-brand-accent/12 text-foreground"
            : "rounded-bl-md border border-border bg-black/35 text-foreground",
        )}
      >
        {message.toolUses?.map((t, i) => (
          <div
            key={i}
            className="mb-2 border-l-2 border-brand-accent/50 pl-2.5 text-xs text-muted-foreground"
          >
            <span className="font-medium text-brand-accent">{tc("toolLabel")}</span> ·{" "}
            <span className="font-mono text-[11px]">{t.name}</span>
          </div>
        ))}
        <div className="prose prose-invert prose-sm prose-p:leading-relaxed prose-pre:bg-input max-w-none prose-headings:text-foreground prose-strong:text-foreground prose-a:text-brand-accent">
          <ReactMarkdown>{message.content || "…"}</ReactMarkdown>
        </div>
      </div>
      {isUser && (
        <span
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold text-foreground/70"
          aria-hidden
        >
          {tc("userLabel")}
        </span>
      )}
    </div>
  );
}
