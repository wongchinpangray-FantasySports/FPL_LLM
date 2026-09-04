"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { ScoutArticleBody } from "@/components/scout/scout-article-body";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Anonymous readers see ~half the article, then a signup/login gate.
 * Signed-in users get the full body with no gate.
 * Full HTML is only sent from the server when already authenticated.
 */
export function ScoutArticleGate({
  html,
  baseUrl,
  serverAuthed,
  gated,
}: {
  /** Preview for guests; full body when serverAuthed. */
  html: string;
  baseUrl: string;
  serverAuthed: boolean;
  /** True when guest preview was truncated. */
  gated: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/scout";
  const t = useTranslations("scout");
  const next = encodeURIComponent(pathname);

  useEffect(() => {
    if (serverAuthed || loading || !user) return;
    router.refresh();
  }, [serverAuthed, loading, user, router]);

  // Existing account just signed in — keep preview briefly while SSR reloads full body.
  if (!serverAuthed && user && gated) {
    return (
      <div className="flex flex-col gap-3">
        <ScoutArticleBody html={html} baseUrl={baseUrl} />
        <p className="text-sm text-muted-foreground">{t("gateUnlocking")}</p>
      </div>
    );
  }

  if (serverAuthed || !gated) {
    return <ScoutArticleBody html={html} baseUrl={baseUrl} />;
  }

  return (
    <div className="relative flex flex-col gap-0">
      <div className="relative">
        <ScoutArticleBody html={html} baseUrl={baseUrl} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-background"
        />
      </div>

      <aside className="relative z-[1] -mt-6 rounded-xl border border-brand-accent/35 bg-gradient-to-br from-brand-accent/10 via-card to-card p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
          {t("gateEyebrow")}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">
          {t("gateTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("gateBody")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/auth/signup?next=${next}`}
            className={cn(buttonVariants({ size: "default" }), "no-underline")}
          >
            {t("gateSignup")}
          </Link>
          <Link
            href={`/auth/login?next=${next}`}
            className={cn(
              buttonVariants({ variant: "secondary", size: "default" }),
              "no-underline",
            )}
          >
            {t("gateLogin")}
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("gateLoginHint")}</p>
      </aside>
    </div>
  );
}
