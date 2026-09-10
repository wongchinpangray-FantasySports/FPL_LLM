"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignupPrompt } from "@/components/auth/signup-prompt-context";
import { FOUNDER_PACK_PATH, founderPackIsPublic } from "@/lib/billing/founder-pack";

const FIRST_KEY = "faleague_founder_prompt_v3_first";
const SECOND_KEY = "faleague_founder_prompt_v3_second";
const FIRST_MS = 60_000;
const SECOND_MS = 5 * 60_000;

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

/** Site-wide offer popup: once at 1 min, again at 5 min (session clock). */
export function HomeSignupPrompt() {
  const pathname = usePathname() ?? "";
  const pathnameRef = useRef(pathname);
  const { user, loading } = useAuth();
  const { openSignupPrompt, closeSignupPrompt } = useSignupPrompt();
  const t = useTranslations("signupPrompt");
  const openedRef = useRef<Set<string>>(new Set());

  pathnameRef.current = pathname;

  useEffect(() => {
    if (!founderPackIsPublic()) return;
    if (loading || user) return;

    const show = (wave: "first" | "second", dismissKey: string) => {
      if (sessionFlag(dismissKey)) return;
      if (openedRef.current.has(wave)) return;
      if (isBlockedPath(pathnameRef.current)) return;
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
    };

    const timers: number[] = [];
    if (!sessionFlag(FIRST_KEY)) {
      timers.push(
        window.setTimeout(() => show("first", FIRST_KEY), FIRST_MS),
      );
    }
    if (!sessionFlag(SECOND_KEY)) {
      timers.push(
        window.setTimeout(() => show("second", SECOND_KEY), SECOND_MS),
      );
    }

    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [loading, user, openSignupPrompt, closeSignupPrompt, t]);

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
