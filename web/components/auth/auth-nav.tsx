"use client";

import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { openInbox } from "@/components/inbox/inbox-envelope-link";
import { cn } from "@/lib/utils";

export function AuthNav({ layout = "inline" }: { layout?: "inline" | "drawer" }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const { user, unreadCount, isAdmin, loading, signOut } = useAuth();

  const wrapClass =
    layout === "drawer"
      ? "flex flex-col gap-0.5"
      : "flex items-center gap-1 sm:gap-2";

  const linkClass =
    layout === "drawer"
      ? "rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      : "rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground sm:text-sm";

  const accentLinkClass =
    layout === "drawer"
      ? "rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-accent hover:bg-muted"
      : cn("rounded-md px-2 py-1 text-xs text-brand-accent hover:text-foreground sm:text-sm");

  if (loading) return null;

  if (!user) {
    return (
      <div className={wrapClass}>
        <Link href="/auth/login" className={linkClass}>
          {t("signIn")}
        </Link>
        <Link href="/auth/signup" className={accentLinkClass}>
          {t("signUp")}
        </Link>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      {isAdmin ? (
        <Link
          href="/admin"
          className={
            layout === "drawer"
              ? "rounded-lg px-3 py-2 text-sm text-amber-200/90 hover:bg-muted hover:text-amber-100"
              : "rounded-md px-2 py-1 text-xs text-amber-200/90 hover:text-amber-100 sm:text-sm"
          }
        >
          {t("admin")}
        </Link>
      ) : null}
      <a
        href="/inbox"
        className={cn(linkClass, "relative inline-flex cursor-pointer items-center gap-2")}
        aria-label={
          unreadCount > 0 ? t("inboxAriaUnread", { n: unreadCount }) : t("inbox")
        }
        onClick={openInbox}
      >
        <Mail className="pointer-events-none h-4 w-4 shrink-0" aria-hidden />
        {t("inbox")}
        {unreadCount > 0 ? (
          <span
            className={cn(
              "flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold text-brand-ink",
              layout === "drawer"
                ? "inline-flex"
                : "absolute -right-0.5 -top-0.5",
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </a>
      <Link href="/account" className={linkClass}>
        {t("account")}
      </Link>
      <button
        type="button"
        onClick={() => {
          void signOut().then(() => router.push("/"));
        }}
        className={cn(linkClass, layout === "drawer" && "text-left")}
      >
        {t("signOut")}
      </button>
    </div>
  );
}
