"use client";

import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

const INBOX_HREF = "/inbox";

/** Full page load — WeChat / WKWebView often drop Next.js client navigations. */
export function openInbox(event?: { preventDefault(): void; stopPropagation(): void }) {
  event?.preventDefault();
  event?.stopPropagation();
  window.location.assign(INBOX_HREF);
}

export function InboxEnvelopeLink({
  className,
}: {
  className?: string;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname() ?? "";
  const { unreadCount, loading } = useAuth();
  const active = pathname === "/inbox" || pathname.startsWith("/inbox/");
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);
  const label =
    unreadCount > 0 ? t("inboxAriaUnread", { n: unreadCount }) : t("inbox");

  return (
    <a
      href={INBOX_HREF}
      className={cn(
        "relative z-20 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-card transition-colors",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        active
          ? "border-brand-accent/50 text-brand-accent"
          : "border-border text-foreground hover:bg-muted hover:text-foreground",
        unreadCount > 0 && "border-brand-accent/40",
        className,
      )}
      aria-label={label}
      title={label}
      onClick={openInbox}
    >
      <Mail className="pointer-events-none h-5 w-5" aria-hidden />
      <span className="sr-only">{t("inbox")}</span>
      {!loading && unreadCount > 0 ? (
        <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold leading-none text-brand-ink">
          {badge}
        </span>
      ) : null}
    </a>
  );
}
