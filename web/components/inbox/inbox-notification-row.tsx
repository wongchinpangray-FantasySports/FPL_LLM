"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { notificationCategory } from "@/lib/notifications/categories";

export type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

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

  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
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
            compact ? "text-sm leading-snug" : "text-base leading-snug",
            item.read_at ? "text-muted-foreground" : "font-medium text-foreground",
          )}
        >
          {item.title}
        </p>
      </div>
      {item.body ? (
        <p
          className={cn(
            "mt-1 text-muted-foreground",
            compact ? "line-clamp-2 text-xs leading-relaxed" : "line-clamp-2 text-sm",
          )}
        >
          {item.body}
        </p>
      ) : null}
      {!compact ? (
        <time className="mt-2 block text-xs text-muted-foreground/80">
          {new Date(item.created_at).toLocaleString()}
        </time>
      ) : null}
    </>
  );

  const className = cn(
    "block transition-colors",
    compact ? "py-2" : "rounded-xl border p-4",
    !compact &&
      (item.read_at
        ? "border-border bg-card/50"
        : "border-brand-accent/20 bg-brand-accent/5"),
  );

  const activate = () => {
    if (onActivate) onActivate();
  };

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
