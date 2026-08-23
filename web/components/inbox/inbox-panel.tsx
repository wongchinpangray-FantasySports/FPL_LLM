"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  InboxNotificationRow,
  type InboxNotification,
} from "@/components/inbox/inbox-notification-row";
import { groupNotificationsByCategory } from "@/lib/notifications/categories";

function InboxSection({
  title,
  items,
  empty,
  categoryLabels,
  onMarkRead,
}: {
  title: string;
  items: InboxNotification[];
  empty: string;
  categoryLabels: { news: string; message: string };
  onMarkRead: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <InboxNotificationRow
                item={n}
                categoryLabels={categoryLabels}
                onActivate={() => void onMarkRead(n.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function InboxPanel() {
  const t = useTranslations("inbox");
  const { refresh } = useAuth();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryLabels = {
    news: t("categoryNews"),
    message: t("categoryMessage"),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as {
        items?: InboxNotification[];
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

  if (loading) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  if (error) {
    return (
      <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        {error}
      </p>
    );
  }

  const { news, message } = groupNotificationsByCategory(items);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        {items.some((n) => !n.read_at) ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void markAllRead()}>
            {t("markAllRead")}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <InboxSection
            title={t("sectionNews")}
            items={news}
            empty={t("emptyNews")}
            categoryLabels={categoryLabels}
            onMarkRead={markRead}
          />
          <InboxSection
            title={t("sectionMessages")}
            items={message}
            empty={t("emptyMessages")}
            categoryLabels={categoryLabels}
            onMarkRead={markRead}
          />
        </>
      )}
    </div>
  );
}
