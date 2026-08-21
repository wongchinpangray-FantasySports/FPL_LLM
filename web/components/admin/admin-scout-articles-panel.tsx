"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NewsThumb } from "@/components/news/news-thumb";
import { ScoutArticleBody } from "@/components/scout/scout-article-body";
import { proxiedNewsImageUrl } from "@/lib/news-image";
import type {
  ScoutArticle,
  ScoutArticleListItem,
  ScoutArticleStatus,
} from "@/lib/scout/types";
import {
  displayScoutBody,
  displayScoutTitle,
  scoutTranslateBadge,
  type ScoutTranslateBadge,
} from "@/lib/scout/zh-status";

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

const ZH_TABS: Array<ScoutTranslateBadge | "all"> = [
  "all",
  "english_only",
  "requested",
  "translated",
  "failed",
];

export function AdminScoutArticlesPanel({ locale }: { locale: string }) {
  const t = useTranslations("adminScout");
  const [status, setStatus] = useState<ScoutArticleStatus | "all">("pending");
  const [zhFilter, setZhFilter] = useState<ScoutTranslateBadge | "all">(
    "all",
  );
  const [items, setItems] = useState<ScoutArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);
  const [preview, setPreview] = useState<ScoutArticle | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const previewRef = useRef<HTMLDivElement>(null);

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
    return items.filter((a) => {
      const badge = scoutTranslateBadge(a);
      if (zhFilter !== "all" && badge !== zhFilter) return false;
      if (!q) return true;
      return (
        a.title_zh.toLowerCase().includes(q) ||
        a.title_en.toLowerCase().includes(q) ||
        a.slug.includes(q)
      );
    });
  }, [items, query, zhFilter]);

  const filteredIds = useMemo(
    () => filtered.map((a) => a.id),
    [filtered],
  );
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  }

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
    setError(null);
    try {
      const res = await fetch(`/api/admin/scout/articles/${id}`, {
        cache: "no-store",
      });
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

  useEffect(() => {
    if (!preview) return;
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [preview]);

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

  async function setQueue(ids: string[], requested: boolean) {
    if (!ids.length) return;
    setQueueBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/scout/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, translate_requested: requested }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("queueError"));
      setSelected(new Set());
      await load();
      if (preview && ids.includes(preview.id)) {
        await openPreview(preview.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("queueError"));
    } finally {
      setQueueBusy(false);
    }
  }

  const previewBadge = preview ? scoutTranslateBadge(preview) : null;
  const previewTitle = preview ? displayScoutTitle(preview) : "";
  const previewHtml = preview ? displayScoutBody(preview) : "";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("articlesSummary")}</p>
      <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {t("cursorQueueHint")}
      </p>

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

      <div className="flex flex-wrap gap-1">
        {ZH_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setZhFilter(tab)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              zhFilter === tab
                ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === "all" ? t("zhFilter.all") : t(`zhBadge.${tab}`)}
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={queueBusy || selected.size === 0}
          onClick={() => void setQueue([...selected], true)}
          className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-sm text-brand-accent disabled:opacity-50"
        >
          {t("requestCursorTranslate")}
        </button>
        <button
          type="button"
          disabled={queueBusy || selected.size === 0}
          onClick={() => void setQueue([...selected], false)}
          className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
        >
          {t("cancelTranslateRequest")}
        </button>
        <span className="text-xs text-muted-foreground">
          {t("selectedCount", { n: selected.size })}
        </span>
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
                <th className="px-3 py-2.5 font-medium">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAllFiltered}
                    aria-label={t("selectAll")}
                  />
                </th>
                <th className="px-3 py-2.5 font-medium">{t("colArticle")}</th>
                <th className="px-3 py-2.5 font-medium">{t("colStatus")}</th>
                <th className="px-3 py-2.5 font-medium">{t("colDate")}</th>
                <th className="px-3 py-2.5 font-medium">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const badge = scoutTranslateBadge(item);
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-t border-border/60",
                      preview?.id === item.id && "bg-brand-accent/5",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        aria-label={displayScoutTitle(item)}
                      />
                    </td>
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
                            className="block w-full cursor-pointer text-left"
                          >
                            <span className="block font-medium text-foreground hover:text-brand-accent">
                              {displayScoutTitle(item)}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground hover:text-brand-accent">
                              {item.title_en}
                            </span>
                          </button>
                          <span
                            className={cn(
                              "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              badge === "translated" &&
                                "bg-emerald-500/15 text-emerald-200",
                              badge === "requested" &&
                                "bg-sky-500/15 text-sky-200",
                              badge === "english_only" &&
                                "bg-muted text-muted-foreground",
                              badge === "failed" &&
                                "bg-rose-500/15 text-rose-200",
                            )}
                          >
                            {t(`zhBadge.${badge}`)}
                          </span>
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
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void openPreview(item.id)}
                          className="rounded-md border border-border px-2 py-1 text-[11px] disabled:opacity-50"
                        >
                          {t("preview")}
                        </button>
                        {item.status !== "published" ? (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void setArticleStatus(item.id, "published")
                            }
                            className="rounded-md bg-brand-accent px-2 py-1 text-[11px] font-semibold text-brand-ink disabled:opacity-50"
                          >
                            {t("publish")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void setArticleStatus(item.id, "pending")
                            }
                            className="rounded-md border border-border px-2 py-1 text-[11px] disabled:opacity-50"
                          >
                            {t("unpublish")}
                          </button>
                        )}
                        {item.status !== "hidden" ? (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void setArticleStatus(item.id, "hidden")
                            }
                            className="rounded-md border border-border px-2 py-1 text-[11px] disabled:opacity-50"
                          >
                            {t("hide")}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
        <div
          ref={previewRef}
          className="scroll-mt-4 rounded-xl border border-border bg-card/40 p-4"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                {t("preview")} · {t(`status.${preview.status}`)}
                {previewBadge ? ` · ${t(`zhBadge.${previewBadge}`)}` : ""}
              </p>
              <h3 className="text-lg font-semibold">{previewTitle}</h3>
              {previewTitle !== preview.title_en ? (
                <p className="text-sm text-muted-foreground">
                  {preview.title_en}
                </p>
              ) : null}
              {previewBadge === "english_only" || previewBadge === "failed" ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("previewEnglishOnly")}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              {preview.translate_requested_at ? (
                <button
                  type="button"
                  disabled={queueBusy}
                  onClick={() => void setQueue([preview.id], false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  {t("cancelTranslateRequest")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={queueBusy}
                  onClick={() => void setQueue([preview.id], true)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  {t("requestCursorTranslate")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                {t("closePreview")}
              </button>
            </div>
          </div>
          {preview.hero_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                proxiedNewsImageUrl(preview.hero_image_url) ??
                preview.hero_image_url
              }
              alt=""
              className="mb-4 max-h-[18rem] w-full rounded-lg object-cover"
            />
          ) : null}
          {previewHtml ? (
            <ScoutArticleBody
              html={previewHtml}
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
