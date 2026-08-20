"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NewsThumb } from "@/components/news/news-thumb";
import { ScoutArticleBody } from "@/components/scout/scout-article-body";
import type {
  ScoutArticle,
  ScoutArticleListItem,
  ScoutArticleStatus,
} from "@/lib/scout/types";

function fmtWhen(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const STATUS_TABS: Array<ScoutArticleStatus | "all"> = [
  "pending",
  "published",
  "hidden",
  "all",
];

export function AdminScoutArticlesPanel({ locale }: { locale: string }) {
  const t = useTranslations("adminScout");
  const [status, setStatus] = useState<ScoutArticleStatus | "all">("pending");
  const [items, setItems] = useState<ScoutArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [preview, setPreview] = useState<ScoutArticle | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/scout/articles?status=${status}`);
      const data = (await res.json()) as {
        items?: ScoutArticleListItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("loadError"));
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (a) =>
        a.title_zh.toLowerCase().includes(q) ||
        a.title_en.toLowerCase().includes(q) ||
        a.slug.includes(q),
    );
  }, [items, query]);

  async function setArticleStatus(id: string, next: ScoutArticleStatus) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/scout/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("updateError"));
      await load();
      if (preview?.id === id) {
        setPreview((p) => (p ? { ...p, status: next } : p));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("updateError"));
    } finally {
      setBusyId(null);
    }
  }

  async function openPreview(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/scout/articles/${id}`);
      const data = (await res.json()) as {
        article?: ScoutArticle;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("loadError"));
      setPreview(data.article ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setBusyId(null);
    }
  }

  async function ingest() {
    setIngesting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/scout/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ingest", pages: 1 }),
      });
      const data = (await res.json()) as {
        error?: string;
        created?: number;
        updated?: number;
        skipped?: number;
        failed?: number;
      };
      if (!res.ok) throw new Error(data.error ?? t("ingestError"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ingestError"));
    } finally {
      setIngesting(false);
    }
  }

  async function retranslate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/scout/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retranslate", id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("translateError"));
      await openPreview(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("translateError"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("articlesSummary")}</p>

      <div className="flex flex-wrap gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatus(tab)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              status === tab
                ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`status.${tab}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchArticles")}
          className="min-w-[12rem] flex-1 rounded-lg border border-border bg-popover px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:border-brand-accent/40"
        >
          {t("refresh")}
        </button>
        <button
          type="button"
          onClick={() => void ingest()}
          disabled={ingesting}
          className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-sm text-brand-accent disabled:opacity-50"
        >
          {ingesting ? t("ingesting") : t("ingestNow")}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loadingArticles")}</p>
      ) : (
        <div className="scroll-table scroll-table--bordered scroll-table--viewport">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">{t("colArticle")}</th>
                <th className="px-3 py-2.5 font-medium">{t("colStatus")}</th>
                <th className="px-3 py-2.5 font-medium">{t("colDate")}</th>
                <th className="px-3 py-2.5 font-medium">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-border/60">
                  <td className="px-3 py-2.5">
                    <div className="flex gap-3">
                      <NewsThumb
                        imageUrl={item.hero_image_url}
                        outlet="FFS"
                        size={48}
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => void openPreview(item.id)}
                          className="text-left font-medium text-foreground hover:text-brand-accent"
                        >
                          {item.title_zh || item.title_en}
                        </button>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.title_en}
                        </p>
                        {item.translation_error ? (
                          <p className="text-[11px] text-rose-300">
                            {t("translationFailed")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        item.status === "published" &&
                          "bg-emerald-500/15 text-emerald-200",
                        item.status === "pending" &&
                          "bg-amber-500/15 text-amber-200",
                        item.status === "hidden" &&
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {t(`status.${item.status}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {fmtWhen(item.source_published_at, locale)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {item.status !== "published" ? (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void setArticleStatus(item.id, "published")}
                          className="rounded-md bg-brand-accent px-2 py-1 text-[11px] font-semibold text-brand-ink disabled:opacity-50"
                        >
                          {t("publish")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void setArticleStatus(item.id, "pending")}
                          className="rounded-md border border-border px-2 py-1 text-[11px] disabled:opacity-50"
                        >
                          {t("unpublish")}
                        </button>
                      )}
                      {item.status !== "hidden" ? (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void setArticleStatus(item.id, "hidden")}
                          className="rounded-md border border-border px-2 py-1 text-[11px] disabled:opacity-50"
                        >
                          {t("hide")}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              {t("emptyArticles")}
            </p>
          ) : null}
        </div>
      )}

      {preview ? (
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                {t("preview")} · {t(`status.${preview.status}`)}
              </p>
              <h3 className="text-lg font-semibold">
                {preview.title_zh || preview.title_en}
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void retranslate(preview.id)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                {t("retranslate")}
              </button>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                {t("closePreview")}
              </button>
            </div>
          </div>
          {preview.body_html_zh || preview.body_html_en ? (
            <ScoutArticleBody
              html={preview.body_html_zh || preview.body_html_en || ""}
              baseUrl={preview.source_url}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("noBody")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
