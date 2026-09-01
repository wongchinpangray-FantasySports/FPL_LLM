"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignupPrompt } from "@/components/auth/signup-prompt-context";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "faleague_scout_signup_prompt_dismissed";
/** 1.5 minutes */
const DELAY_MS = 90_000;

/** Inline CTA for guests reading a Scout article. */
export function ScoutSignupCta() {
  const { user, loading } = useAuth();
  const t = useTranslations("scout");
  const pathname = usePathname() ?? "/scout";
  const next = encodeURIComponent(pathname);

  if (loading || user) return null;

  return (
    <aside className="rounded-xl border border-brand-accent/35 bg-gradient-to-br from-brand-accent/10 via-card to-card p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
        {t("signupCtaEyebrow")}
      </p>
      <h2 className="mt-1 text-base font-semibold text-foreground sm:text-lg">
        {t("signupCtaTitle")}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {t("signupCtaBody")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/auth/signup?next=${next}`}
          className={cn(buttonVariants({ size: "sm" }), "no-underline")}
        >
          {t("signupCtaButton")}
        </Link>
        <Link
          href={`/auth/login?next=${next}`}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "no-underline",
          )}
        >
          {t("signupCtaLogin")}
        </Link>
      </div>
    </aside>
  );
}

/** After 1.5 minutes on a Scout article, ask guests to sign up. */
export function ScoutSignupPrompt() {
  const { user, loading } = useAuth();
  const { openSignupPrompt } = useSignupPrompt();
  const t = useTranslations("signupPrompt");
  const pathname = usePathname() ?? "/scout";
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* private browsing */
    }

    const id = window.setTimeout(() => setArmed(true), DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!armed || loading || user) return;

    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    openSignupPrompt({
      title: t("scoutArticleTitle"),
      body: t("scoutArticleBody"),
      dismissKey: STORAGE_KEY,
      nextPath: pathname,
    });
  }, [armed, loading, user, openSignupPrompt, t, pathname]);

  return null;
}
