"use client";

import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

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
    <Link
      href="/inbox"
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-card transition-colors",
        active
          ? "border-brand-accent/50 text-brand-accent"
          : "border-border text-foreground hover:bg-muted hover:text-foreground",
        unreadCount > 0 && "border-brand-accent/40",
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Mail className="pointer-events-none h-5 w-5" aria-hidden />
      {!loading && unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold leading-none text-brand-ink">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
