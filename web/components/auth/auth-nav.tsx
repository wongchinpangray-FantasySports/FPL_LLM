"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

export function AuthNav() {
  const t = useTranslations("nav");
  const router = useRouter();
  const { user, unreadCount, loading, signOut } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/auth/login"
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground sm:text-sm"
        >
          {t("signIn")}
        </Link>
        <Link
          href="/auth/signup"
          className={cn(
            "rounded-md px-2 py-1 text-xs text-brand-accent hover:text-foreground sm:text-sm",
          )}
        >
          {t("signUp")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link
        href="/inbox"
        className="relative rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground sm:text-sm"
      >
        {t("inbox")}
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold text-brand-ink">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Link>
      <Link
        href="/account"
        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground sm:text-sm"
      >
        {t("account")}
      </Link>
      <button
        type="button"
        onClick={() => {
          void signOut().then(() => router.push("/"));
        }}
        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground sm:text-sm"
      >
        {t("signOut")}
      </button>
    </div>
  );
}
