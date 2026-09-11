"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignupPrompt } from "@/components/auth/signup-prompt-context";
import { FOUNDER_PACK_PATH, founderPackIsPublic } from "@/lib/billing/founder-pack";

/** Session flags — bump version when schedule changes so old dismissals reset. */
const FIRST_KEY = "faleague_founder_prompt_v4_first";
const SECOND_KEY = "faleague_founder_prompt_v4_second";
/** First popup shortly after landing (any page). */
const FIRST_MS = 600;
/** Second popup 2 minutes after landing. */
const SECOND_MS = 2 * 60_000;

function sessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

function isBlockedPath(pathname: string): boolean {
  return (
    pathname === "/pro" ||
    pathname.startsWith("/pro/") ||
    pathname.startsWith("/auth")
  );
}

/**
 * Site-wide PRO offer popup (any page except /pro and /auth):
 * 1st wave on arrival, 2nd wave at 2 minutes.
 * Guests + logged-in non-premium. Premium users skipped.
 */
export function HomeSignupPrompt() {
  const pathname = usePathname() ?? "";
  const pathnameRef = useRef(pathname);
  const { user, profile, loading } = useAuth();
  const { openSignupPrompt, closeSignupPrompt } = useSignupPrompt();
  const t = useTranslations("signupPrompt");
  const openedRef = useRef<Set<string>>(new Set());

  pathnameRef.current = pathname;

  useEffect(() => {
    if (!founderPackIsPublic()) return;
    if (loading) return;
    if (profile?.insights_plan === "premium") return;

    const show = (wave: "first" | "second", dismissKey: string): boolean => {
      if (sessionFlag(dismissKey)) return false;
      if (openedRef.current.has(wave)) return false;
      if (isBlockedPath(pathnameRef.current)) return false;
      openedRef.current.add(wave);
      closeSignupPrompt();
      openSignupPrompt({
        eyebrow: t("founderEyebrow"),
        title: t("founderTitle"),
        body: t("founderBody"),
        benefits: [
          t("founderBenefit1"),
          t("founderBenefit2"),
          t("founderBenefit3"),
        ],
        primaryHref: FOUNDER_PACK_PATH,
        primaryLabel: t("founderCta"),
        nextPath: FOUNDER_PACK_PATH,
        dismissKey,
      });
      return true;
    };

    const timers: number[] = [];

    // First wave: soon after arrive; retry on navigation if first attempt was blocked (/pro).
    if (!sessionFlag(FIRST_KEY) && !openedRef.current.has("first")) {
      timers.push(
        window.setTimeout(() => {
          show("first", FIRST_KEY);
        }, FIRST_MS),
      );
    }

    if (!sessionFlag(SECOND_KEY) && !openedRef.current.has("second")) {
      timers.push(
        window.setTimeout(() => {
          show("second", SECOND_KEY);
        }, SECOND_MS),
      );
    }

    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [loading, user, profile, openSignupPrompt, closeSignupPrompt, t]);

  // If first wave was blocked because user landed on /pro, try again when they leave.
  useEffect(() => {
    if (!founderPackIsPublic()) return;
    if (loading) return;
    if (profile?.insights_plan === "premium") return;
    if (sessionFlag(FIRST_KEY) || openedRef.current.has("first")) return;
    if (isBlockedPath(pathname)) return;

    const id = window.setTimeout(() => {
      if (sessionFlag(FIRST_KEY) || openedRef.current.has("first")) return;
      if (isBlockedPath(pathnameRef.current)) return;
      openedRef.current.add("first");
      closeSignupPrompt();
      openSignupPrompt({
        eyebrow: t("founderEyebrow"),
        title: t("founderTitle"),
        body: t("founderBody"),
        benefits: [
          t("founderBenefit1"),
          t("founderBenefit2"),
          t("founderBenefit3"),
        ],
        primaryHref: FOUNDER_PACK_PATH,
        primaryLabel: t("founderCta"),
        nextPath: FOUNDER_PACK_PATH,
        dismissKey: FIRST_KEY,
      });
    }, 400);

    return () => window.clearTimeout(id);
  }, [
    pathname,
    loading,
    profile,
    openSignupPrompt,
    closeSignupPrompt,
    t,
  ]);

  return null;
}

export function dismissHomeSignupPrompt(): void {
  try {
    sessionStorage.setItem(FIRST_KEY, "1");
    sessionStorage.setItem(SECOND_KEY, "1");
  } catch {
    /* ignore */
  }
}
