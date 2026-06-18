"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export function InboxPanel() {
  const t = useTranslations("inbox");
  const { refresh } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as {
        items?: Notification[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("loadError"));
      setItems(data.items ?? []);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [refresh, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
      ),
    );
    await refresh();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setItems((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
    );
    await refresh();
  }

  if (loading) return <p className="text-sm text-slate-400">{t("loading")}</p>;
  if (error) {
    return (
      <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">{t("subtitle")}</p>
        {items.some((n) => !n.read_at) ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void markAllRead()}>
            {t("markAllRead")}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const inner = (
              <>
                <p className="font-medium text-white">{n.title}</p>
                {n.body ? (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{n.body}</p>
                ) : null}
                <time className="mt-2 block text-xs text-slate-600">
                  {new Date(n.created_at).toLocaleString()}
                </time>
              </>
            );

            const className = cn(
              "block rounded-xl border p-4 transition-colors",
              n.read_at
                ? "border-white/[0.06] bg-white/[0.02]"
                : "border-brand-accent/20 bg-brand-accent/5",
            );

            if (n.href?.startsWith("http")) {
              return (
                <li key={n.id}>
                  <a
                    href={n.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                    onClick={() => void markRead(n.id)}
                  >
                    {inner}
                  </a>
                </li>
              );
            }

            if (n.href?.startsWith("/")) {
              return (
                <li key={n.id}>
                  <Link href={n.href} className={className} onClick={() => void markRead(n.id)}>
                    {inner}
                  </Link>
                </li>
              );
            }

            return (
              <li key={n.id}>
                <div
                  className={cn(className, "cursor-pointer")}
                  onClick={() => void markRead(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void markRead(n.id);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {inner}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
