"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignupPrompt } from "@/components/auth/signup-prompt-context";

export function RequireAuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { openSignupPrompt } = useSignupPrompt();
  const t = useTranslations("signupPrompt");
  const prompted = useRef(false);

  useEffect(() => {
    if (loading || user || prompted.current) return;
    prompted.current = true;
    openSignupPrompt({
      title: t("fplNewsTitle"),
      body: t("fplNewsBody"),
    });
  }, [loading, user, openSignupPrompt, t]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("fplNewsLoading")}</p>;
  }

  if (!user) {
    return (
      <p className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        {t("fplNewsSignInHint")}
      </p>
    );
  }

  return children;
}
