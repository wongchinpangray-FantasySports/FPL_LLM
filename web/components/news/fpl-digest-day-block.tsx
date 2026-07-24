import type { FplXDigestRecord, FplXDigestSource } from "@/lib/fpl/fpl-x-digest";

export function fmtLondonDigestWindow(
  start: string,
  end: string,
  locale: string,
): string {
  try {
    const fmt = new Intl.DateTimeFormat(locale, {
      timeZone: "Europe/London",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
  } catch {
    return `${start.slice(0, 16)} – ${end.slice(0, 16)}`;
  }
}

function DigestSummaryBody({ summary }: { summary: string }) {
  const blocks = summary.split(/\n\n+/).filter(Boolean);

  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block) => {
        const lines = block.split("\n").filter(Boolean);
        const heading = lines[0]?.startsWith("## ")
          ? lines[0].replace(/^##\s+/, "").trim()
          : null;
        const bodyLines = heading ? lines.slice(1) : lines;
        const bullets = bodyLines.filter((line) => line.trim().startsWith("- "));
        const prose = bodyLines.filter((line) => !line.trim().startsWith("- "));

        return (
          <section key={block.slice(0, 48)}>
            {heading ? (
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-accent">
                {heading}
              </h3>
            ) : null}
            {bullets.length > 0 ? (
              <ul className="space-y-1.5 pl-1">
                {bullets.map((line) => (
                  <li
                    key={line.slice(0, 60)}
                    className="relative pl-3 before:absolute before:left-0 before:top-[0.55em] before:h-1 before:w-1 before:rounded-full before:bg-brand-accent/70"
                  >
                    {line.replace(/^\-\s+/, "")}
                  </li>
                ))}
              </ul>
            ) : null}
            {prose.map((line) => (
              <p key={line.slice(0, 40)} className="text-foreground/85">
                {line}
              </p>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function SourceRow({ source }: { source: FplXDigestSource }) {
  return (
    <li className="text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground/80">{source.outlet}</span>
      {source.kind === "headline" ? (
        <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground/60">
          headline
        </span>
      ) : null}
      {" — "}
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-accent hover:underline"
      >
        {source.text.slice(0, 120)}
        {source.text.length > 120 ? "…" : ""}
      </a>
    </li>
  );
}

export type FplDigestDayLabels = {
  windowLabel: string;
  sourcesTitle: string;
  generatedAt: string;
};

export function FplDigestDayBlock({
  digest,
  locale,
  labels,
  defaultSourcesOpen = false,
}: {
  digest: FplXDigestRecord & { summary: string };
  locale: string;
  labels: FplDigestDayLabels;
  defaultSourcesOpen?: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-card/50 p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-accent">
          {digest.digest_date}
        </span>
        <span className="text-xs text-muted-foreground">
          {labels.windowLabel}:{" "}
          {fmtLondonDigestWindow(
            digest.window_start,
            digest.window_end,
            locale,
          )}
        </span>
      </header>

      <DigestSummaryBody summary={digest.summary} />

      <p className="mt-4 text-[11px] text-muted-foreground">
        {labels.generatedAt}{" "}
        {fmtLondonDigestWindow(
          digest.generated_at,
          digest.generated_at,
          locale,
        )}
      </p>

      {digest.source_items.length > 0 ? (
        <details
          className="mt-4 rounded-lg border border-border/80 bg-card/30 px-3 py-2"
          open={defaultSourcesOpen}
        >
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            {labels.sourcesTitle} ({digest.source_items.length})
          </summary>
          <ul className="mt-3 space-y-2 pl-1">
            {digest.source_items.map((source) => (
              <SourceRow
                key={`${source.url}-${source.text.slice(0, 24)}`}
                source={source}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}
