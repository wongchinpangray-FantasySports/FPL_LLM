"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { notificationCategory } from "@/lib/notifications/categories";
import {
  parseScoutReleaseBody,
  scoutReleaseDisplayTitle,
} from "@/lib/notifications/scout-release";
import {
  FOUNDER_PACK_PATH,
  SAMPLE_REPORT_A_PDF,
  SAMPLE_REPORT_B_PDF,
} from "@/lib/billing/founder-pack";

export type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function NotificationBody({
  item,
  compact,
}: {
  item: InboxNotification;
  compact: boolean;
}) {
  if (item.type === "scout_release") {
    const parsed = parseScoutReleaseBody(item.body);
    const titles = parsed.titles;
    const shown = compact ? titles.slice(0, 3) : titles;
    const hidden = compact
      ? Math.max(0, titles.length - shown.length) + parsed.extra
      : parsed.extra;

    if (shown.length > 0) {
      return (
        <div className={cn("mt-2 min-w-0", compact ? "text-xs" : "text-sm")}>
          <ul className="space-y-1.5 text-muted-foreground">
            {shown.map((line, i) => (
              <li
                key={`${i}-${line.slice(0, 48)}`}
                className="flex gap-2 leading-relaxed"
              >
                <span
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-accent/80"
                  aria-hidden
                />
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                  {line}
                </span>
              </li>
            ))}
          </ul>
          {hidden > 0 ? (
            <p className="mt-1.5 pl-3 text-muted-foreground/80">另有 {hidden} 篇</p>
          ) : null}
          {parsed.footer && !compact ? (
            <p className="mt-2 break-words pl-3 text-xs leading-relaxed text-muted-foreground/80">
              {parsed.footer}
            </p>
          ) : null}
        </div>
      );
    }
  }

  return (
    <p
      className={cn(
        "mt-1 min-w-0 break-words whitespace-pre-line text-muted-foreground [overflow-wrap:anywhere]",
        compact ? "line-clamp-3 text-xs leading-relaxed" : "line-clamp-8 text-sm leading-relaxed",
      )}
    >
      {item.body}
    </p>
  );
}

export function InboxNotificationRow({
  item,
  compact = false,
  showCategory = false,
  categoryLabels,
  onActivate,
}: {
  item: InboxNotification;
  compact?: boolean;
  showCategory?: boolean;
  categoryLabels?: { news: string; message: string };
  onActivate?: () => void;
}) {
  const category = notificationCategory(item.type);
  const categoryLabel =
    category === "news"
      ? categoryLabels?.news ?? "News"
      : categoryLabels?.message ?? "Message";
  const isOffer = item.type === "founder_pack_offer";
  const scoutParsed =
    item.type === "scout_release" ? parseScoutReleaseBody(item.body) : null;
  const title = scoutParsed
    ? scoutReleaseDisplayTitle(
        item.title,
        scoutParsed.titles.length + scoutParsed.extra,
      )
    : item.title;

  const content = (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {showCategory ? (
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              category === "news"
                ? "bg-sky-500/15 text-sky-300"
                : "bg-violet-500/15 text-violet-300",
            )}
          >
            {categoryLabel}
          </span>
        ) : null}
        <p
          className={cn(
            "min-w-0 flex-1 break-words [overflow-wrap:anywhere]",
            compact ? "text-sm leading-snug" : "text-base leading-snug",
            item.read_at ? "text-muted-foreground" : "font-medium text-foreground",
          )}
        >
          {title}
        </p>
      </div>
      {item.body ? <NotificationBody item={item} compact={compact} /> : null}
      {isOffer && !compact ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={item.href?.startsWith("/") ? item.href : FOUNDER_PACK_PATH}
            className="inline-flex rounded-lg bg-brand-accent px-3 py-1.5 text-xs font-semibold text-brand-ink no-underline hover:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              onActivate?.();
            }}
          >
            去开通
          </Link>
          <a
            href={SAMPLE_REPORT_A_PDF}
            download="faleague-sample-a-19.pdf"
            className="inline-flex rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground no-underline hover:bg-muted/80"
            onClick={(e) => {
              e.stopPropagation();
              onActivate?.();
            }}
          >
            参考报告 A ¥9.9
          </a>
          <a
            href={SAMPLE_REPORT_B_PDF}
            download="faleague-sample-b-49.pdf"
            className="inline-flex rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground no-underline hover:bg-muted/80"
            onClick={(e) => {
              e.stopPropagation();
              onActivate?.();
            }}
          >
            参考报告 B ¥39.9
          </a>
        </div>
      ) : null}
      {!compact ? (
        <time className="mt-2 block text-xs text-muted-foreground/80">
          {new Date(item.created_at).toLocaleString()}
        </time>
      ) : null}
    </>
  );

  const className = cn(
    "block min-w-0 overflow-hidden transition-colors",
    compact ? "py-2" : "rounded-xl border p-4",
    !compact &&
      (item.read_at
        ? "border-border bg-card/50"
        : "border-brand-accent/20 bg-brand-accent/5"),
  );

  const activate = () => {
    if (onActivate) onActivate();
  };

  // Offer cards use explicit buttons — avoid wrapping the whole row in one link.
  if (isOffer && !compact) {
    return <div className={className}>{content}</div>;
  }

  if (item.href?.startsWith("http")) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={activate}
      >
        {content}
      </a>
    );
  }

  if (item.href?.startsWith("/")) {
    return (
      <Link href={item.href} className={cn(className, "no-underline")} onClick={activate}>
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cn(className, "cursor-pointer")}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter") activate();
      }}
      role="button"
      tabIndex={0}
    >
      {content}
    </div>
  );
}
