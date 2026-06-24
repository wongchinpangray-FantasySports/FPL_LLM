"use client";

import { Link } from "@/i18n/navigation";
import { WcFlag } from "@/components/worldcup/wc-flag";
import { cn } from "@/lib/utils";

type ArticleListItem = {
  id: number;
  home: string;
  away: string;
  home_code: string;
  away_code: string;
  score: string | null;
  kickoff: string | null;
  round_label: string;
  kind: "report" | "preview";
  featured?: boolean;
};

export function WcArticlesList({
  matches,
  labels,
}: {
  matches: ArticleListItem[];
  labels: {
    featured: string;
    read: string;
    preview: string;
    report: string;
    empty: string;
  };
}) {
  if (matches.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {matches.map((m) => (
        <Link
          key={m.id}
          href={`/worldcup/articles/${m.id}`}
          className={cn(
            "block rounded-xl border p-4 no-underline transition-colors",
            m.featured
              ? "border-brand-accent/35 bg-brand-accent/5 hover:bg-brand-accent/10"
              : "border-border bg-card/50 hover:border-brand-accent/25 hover:bg-card",
          )}
        >
          {m.featured ? (
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
              {labels.featured}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                <WcFlag code={m.home_code} size={18} title={m.home} />
                <span>{m.home}</span>
                <span className="text-muted-foreground">vs</span>
                <WcFlag code={m.away_code} size={18} title={m.away} />
                <span>{m.away}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {m.round_label}
                {m.score ? ` · ${m.score}` : ""}
                {m.kickoff
                  ? ` · ${m.kickoff.slice(0, 16).replace("T", " ")}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                  m.kind === "preview"
                    ? "bg-sky-500/15 text-sky-300"
                    : "bg-emerald-500/15 text-emerald-300",
                )}
              >
                {m.kind === "preview" ? labels.preview : labels.report}
              </span>
              <span className="text-sm text-brand-accent">{labels.read} →</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
