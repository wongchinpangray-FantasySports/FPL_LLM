"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "@/i18n/navigation";
import { wcTeamFlag } from "@/lib/wc/wc-team-flags";
import { cn } from "@/lib/utils";

type ArticlePayload = {
  headline: string;
  body: string;
  kind: "report" | "preview";
  source?: string;
  home?: string;
  away?: string;
  home_code?: string;
  away_code?: string;
  score?: string | null;
  kickoff?: string | null;
  round_label?: string;
  venue?: string | null;
  error?: string;
};

export function WcArticleReader({
  matchId,
  locale,
  labels,
}: {
  matchId: number;
  locale: string;
  labels: {
    loading: string;
    error: string;
    back: string;
    previewBadge: string;
    reportBadge: string;
    sourceAi: string;
    sourceTemplate: string;
  };
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<ArticlePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/worldcup/match-article?matchId=${encodeURIComponent(String(matchId))}&locale=${encodeURIComponent(locale)}`,
        );
        const json = (await res.json()) as ArticlePayload;
        if (!res.ok) throw new Error(json.error ?? labels.error);
        if (!cancelled) setArticle(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : labels.error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId, locale, labels.error]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{labels.loading}</p>;
  }

  if (error || !article) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
        <p className="text-sm text-rose-200">{error ?? labels.error}</p>
        <Link href="/worldcup/articles" className="mt-3 inline-block text-sm text-brand-accent">
          {labels.back}
        </Link>
      </div>
    );
  }

  const homeFlag = article.home_code ? wcTeamFlag(article.home_code) : "🏳️";
  const awayFlag = article.away_code ? wcTeamFlag(article.away_code) : "🏳️";

  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-medium uppercase tracking-wide",
            article.kind === "preview"
              ? "bg-sky-500/15 text-sky-300"
              : "bg-emerald-500/15 text-emerald-300",
          )}
        >
          {article.kind === "preview" ? labels.previewBadge : labels.reportBadge}
        </span>
        {article.round_label ? <span>{article.round_label}</span> : null}
        {article.score ? (
          <span className="font-semibold text-foreground">{article.score}</span>
        ) : null}
        {article.source === "gemini" ? (
          <span className="text-muted-foreground/80">{labels.sourceAi}</span>
        ) : article.source === "template" ? (
          <span className="text-muted-foreground/80">{labels.sourceTemplate}</span>
        ) : null}
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
          <span>{homeFlag}</span>
          <span>{article.home}</span>
          <span className="text-muted-foreground">vs</span>
          <span>{awayFlag}</span>
          <span>{article.away}</span>
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          {article.headline}
        </h1>
        {article.venue || article.kickoff ? (
          <p className="text-sm text-muted-foreground">
            {[article.venue, article.kickoff?.slice(0, 16).replace("T", " ")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </header>

      <div
        className={cn(
          "prose prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight",
          "prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-lg prose-p:leading-relaxed prose-p:text-foreground/90",
        )}
      >
        <ReactMarkdown>{article.body}</ReactMarkdown>
      </div>

      <Link
        href="/worldcup/articles"
        className="text-sm text-brand-accent hover:underline"
      >
        {labels.back}
      </Link>
    </article>
  );
}
