"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { WhatsNewData, WhatsNewItem } from "@/lib/home/whats-new";

function fmtDelta(delta: number): string {
  const abs = Math.abs(delta).toFixed(1);
  return delta > 0 ? `+£${abs}` : `-£${abs}`;
}

function articleTitle(
  item: Extract<WhatsNewItem, { kind: "article" }>,
  locale: string,
): string {
  if (locale.startsWith("zh") && item.title_zh?.trim()) return item.title_zh;
  return item.title_en;
}

function WhatsNewRow({ item }: { item: WhatsNewItem }) {
  const t = useTranslations("home");
  const locale = useLocale();

  if (item.kind === "price") {
    const rise = item.direction === "rise";
    return (
      <Link
        href={item.href}
        className="flex items-start gap-2.5 py-2 no-underline transition-colors hover:opacity-90"
      >
        <span
          className={cn(
            "mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide",
            rise ? "text-emerald-400" : "text-rose-400",
          )}
          aria-hidden
        >
          {rise ? "↑" : "↓"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {item.web_name}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {item.team}
            </span>
          </span>
          <span
            className={cn(
              "mt-0.5 block text-[11px] tabular-nums",
              rise ? "text-emerald-400/90" : "text-rose-400/90",
            )}
          >
            {rise ? t("whatsNewPriceRise") : t("whatsNewPriceFall")} ·{" "}
            {fmtDelta(item.delta)}
          </span>
        </span>
      </Link>
    );
  }

  if (item.kind === "injury") {
    const red = item.status === "i";
    return (
      <Link
        href={item.href}
        className="flex items-start gap-2.5 py-2 no-underline transition-colors hover:opacity-90"
      >
        <span
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[11px] font-bold leading-none",
            red
              ? "bg-rose-500/20 text-rose-400"
              : "bg-amber-400/20 text-amber-400",
          )}
          title={red ? t("whatsNewInjuryRed") : t("whatsNewInjuryYellow")}
          aria-label={red ? t("whatsNewInjuryRed") : t("whatsNewInjuryYellow")}
        >
          !
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {item.web_name}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {item.team}
            </span>
          </span>
          <span className="mt-0.5 block line-clamp-2 text-[11px] text-muted-foreground">
            {item.news?.trim()
              ? item.news
              : red
                ? t("whatsNewInjuryRed")
                : t("whatsNewInjuryYellow")}
            {item.chance != null ? ` · ${item.chance}%` : ""}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      className="flex items-start gap-2.5 py-2 no-underline transition-colors hover:opacity-90"
    >
      <span
        className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand-accent"
        aria-hidden
      >
        FFS
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {articleTitle(item, locale)}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {t("whatsNewArticleTag")}
        </span>
      </span>
    </Link>
  );
}

export function WhatsNewSidebar() {
  const t = useTranslations("home");
  const [data, setData] = useState<WhatsNewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/home/whats-new")
      .then(async (res) => {
        const json = (await res.json()) as WhatsNewData & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "failed");
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const prices = data?.items.filter((i) => i.kind === "price") ?? [];
  const injuries = data?.items.filter((i) => i.kind === "injury") ?? [];
  const articles = data?.items.filter((i) => i.kind === "article") ?? [];
  const empty =
    !loading && !error && prices.length === 0 && injuries.length === 0 && articles.length === 0;

  return (
    <aside className="home-hub-card overflow-hidden rounded-xl border border-border bg-card/40 lg:sticky lg:top-[4.5rem] lg:self-start">
      <div className="border-b border-border/70 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("whatsNewTitle", {
            date: data?.date_label ?? "—.—",
          })}
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {t("whatsNewHint")}
        </p>
      </div>

      <div className="px-4 py-2">
        {loading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-md bg-muted/50"
              />
            ))}
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-muted-foreground">{t("whatsNewError")}</p>
        ) : empty ? (
          <p className="py-4 text-sm text-muted-foreground">{t("whatsNewEmpty")}</p>
        ) : (
          <div className="divide-y divide-border/50">
            {prices.length > 0 ? (
              <section className="py-1.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {t("whatsNewPriceSection")}
                  </p>
                  <Link
                    href="/fpl/insights/price-changes"
                    className="text-[11px] font-medium text-brand-accent no-underline hover:underline"
                  >
                    {t("whatsNewSeeAll")}
                  </Link>
                </div>
                {prices.map((item) => (
                  <WhatsNewRow key={`p-${item.fpl_id}`} item={item} />
                ))}
              </section>
            ) : null}

            {injuries.length > 0 ? (
              <section className="py-1.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("whatsNewInjurySection")}
                </p>
                {injuries.map((item) => (
                  <WhatsNewRow key={`i-${item.fpl_id}`} item={item} />
                ))}
              </section>
            ) : null}

            {articles.length > 0 ? (
              <section className="py-1.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {t("whatsNewArticleSection")}
                  </p>
                  <Link
                    href="/scout"
                    className="text-[11px] font-medium text-brand-accent no-underline hover:underline"
                  >
                    {t("whatsNewSeeAll")}
                  </Link>
                </div>
                {articles.map((item) => (
                  <WhatsNewRow key={`a-${item.id}`} item={item} />
                ))}
              </section>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
