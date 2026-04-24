"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useEntryId } from "./entry-id-form";
import { cn } from "@/lib/utils";

type Role = "user" | "assistant";
interface UiMessage {
  role: Role;
  content: string;
  toolUses?: { name: string; input: unknown }[];
}

const SUGGESTIONS = [
  "Captain this GW?",
  "Best midfielder under £8m?",
  "Saka vs Palmer — next 5 GWs",
  "Easiest fixtures next 4 GWs?",
];

export function Chat() {
  const { entryId } = useEntryId();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  async function send(content: string) {
    if (!content.trim() || streaming) return;

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
        body: JSON.stringify({
          messages: requestMessages,
          entryId,
        }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data:")) continue;
          const payload = part.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload);
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (!last || last.role !== "assistant") return copy;
              if (evt.type === "text") {
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + evt.delta,
                };
              } else if (evt.type === "tool_use") {
                copy[copy.length - 1] = {
                  ...last,
                  toolUses: [
                    ...(last.toolUses ?? []),
                    { name: evt.name, input: evt.input },
                  ],
                };
              } else if (evt.type === "error") {
                copy[copy.length - 1] = {
                  ...last,
                  content:
                    (last.content ? last.content + "\n\n" : "") +
                    `_Error: ${evt.message}_`,
                };
              }
              return copy;
            });
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          copy[copy.length - 1] = {
            ...last,
            content: `Sorry — ${(err as Error).message}`,
          };
        }
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex min-h-[min(520px,calc(100vh-22rem))] flex-col md:min-h-[calc(100vh-20rem)]">
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]"
      >
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          {messages.length === 0 && (
            <div className="flex flex-col gap-5 rounded-xl border border-dashed border-white/10 bg-black/20 p-5 text-slate-300 md:p-6">
              <p className="text-sm leading-relaxed">
                FPL questions — fixtures, form, captaincy, transfers.
                {entryId ? (
                  <>
                    {" "}
                    Squad linked (
                    <span className="font-medium text-brand-accent">
                      {entryId}
                    </span>
                    ).
                  </>
                ) : (
                  <> Add Entry ID on Home for your XI.</>
                )}
              </p>
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Examples
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-white/[0.1] bg-white/[0.06] px-3.5 py-2 text-left text-xs text-slate-200 transition-colors hover:border-brand-accent/35 hover:bg-white/[0.1]"
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
          className="flex gap-2 border-t border-white/[0.06] bg-black/25 p-3 md:p-4"
        >
          <Input
            placeholder="Message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            className="flex-1 border-white/[0.08] bg-black/30"
          />
          <Button type="submit" disabled={streaming || !input.trim()}>
            {streaming ? "…" : "Send"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Message({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <span
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-accent/40 bg-brand-accent/15 text-[10px] font-bold text-brand-accent"
          aria-hidden
        >
          AI
        </span>
      )}
      <div
        className={cn(
          "max-w-[min(85%,560px)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "rounded-br-md border border-brand-accent/35 bg-brand-accent/12 text-slate-100"
            : "rounded-bl-md border border-white/[0.08] bg-black/35 text-slate-100",
        )}
      >
        {message.toolUses?.map((t, i) => (
          <div
            key={i}
            className="mb-2 border-l-2 border-brand-accent/50 pl-2.5 text-xs text-slate-400"
          >
            <span className="font-medium text-brand-accent">Tool</span> ·{" "}
            <span className="font-mono text-[11px]">{t.name}</span>
          </div>
        ))}
        <div className="prose prose-invert prose-sm prose-p:leading-relaxed prose-pre:bg-black/40 max-w-none prose-headings:text-slate-100 prose-strong:text-white prose-a:text-brand-accent">
          <ReactMarkdown>{message.content || "…"}</ReactMarkdown>
        </div>
      </div>
      {isUser && (
        <span
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[10px] font-semibold text-slate-300"
          aria-hidden
        >
          U
        </span>
      )}
    </div>
  );
}
