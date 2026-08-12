"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignupPrompt } from "@/components/auth/signup-prompt-context";

type SignupPromptKey =
  | "title"
  | "body"
  | "fplNewsTitle"
  | "fplNewsBody"
  | "fplNewsLoading"
  | "fplNewsSignInHint"
  | "recommendedSquadTitle"
  | "recommendedSquadBody"
  | "recommendedSquadLoading"
  | "recommendedSquadSignInHint";

export function RequireAuthGate({
  children,
  titleKey = "fplNewsTitle",
  bodyKey = "fplNewsBody",
  loadingKey = "fplNewsLoading",
  hintKey = "fplNewsSignInHint",
}: {
  children: React.ReactNode;
  titleKey?: SignupPromptKey;
  bodyKey?: SignupPromptKey;
  loadingKey?: SignupPromptKey;
  hintKey?: SignupPromptKey;
}) {
  const { user, loading } = useAuth();
  const { openSignupPrompt } = useSignupPrompt();
  const t = useTranslations("signupPrompt");
  const prompted = useRef(false);

  useEffect(() => {
    if (loading || user || prompted.current) return;
    prompted.current = true;
    openSignupPrompt({
      title: t(titleKey),
      body: t(bodyKey),
    });
  }, [loading, user, openSignupPrompt, t, titleKey, bodyKey]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t(loadingKey)}</p>;
  }

  if (!user) {
    return (
      <p className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        {t(hintKey)}
      </p>
    );
  }

  return children;
}
