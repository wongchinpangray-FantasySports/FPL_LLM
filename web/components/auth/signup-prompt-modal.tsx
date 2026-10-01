"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignupPrompt } from "@/components/auth/signup-prompt-context";
import { FOUNDER_PACK_TEASER_PATH, founderPackIsPublic } from "@/lib/billing/founder-pack";
import {
  isFplScreenDismissed,
  readFplScreen,
} from "@/lib/fpl/first-visit-screen";

/** Session flags — bump when schedule or audience changes so old dismissals reset. */
const GUEST_FIRST_KEY = "faleague_signup_prompt_v5_first";
const GUEST_SECOND_KEY = "faleague_signup_prompt_v5_second";
const SIGNED_IN_PRO_KEY = "faleague_founder_prompt_v5_signedin";

/** Let guests read the page before asking them to register. */
const GUEST_FIRST_MS = 8_000;
const GUEST_SECOND_MS = 2 * 60_000;
/** Signed-in non-premium: one quieter PRO ask, not on arrival. */
const SIGNED_IN_PRO_MS = 2 * 60_000;

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
    pathname.startsWith("/auth") ||
    pathname.startsWith("/scout")
  );
}

/**
 * Guests: free signup (8s, then 2 min). Site is not framed as paid.
 * Signed-in non-premium: one PRO prompt at 2 minutes. Premium skipped.
 */
export function HomeSignupPrompt() {
  const pathname = usePathname() ?? "";
  const pathnameRef = useRef(pathname);
  const { user, profile, loading } = useAuth();
  const { openSignupPrompt, closeSignupPrompt } = useSignupPrompt();
  const t = useTranslations("signupPrompt");
  const openedRef = useRef<Set<string>>(new Set());
  const guestFirstDueRef = useRef(false);

  pathnameRef.current = pathname;

  const openGuestPrompt = (wave: "first" | "second", dismissKey: string): boolean => {
    if (sessionFlag(dismissKey)) return false;
    if (openedRef.current.has(`guest-${wave}`)) return false;
    if (isBlockedPath(pathnameRef.current)) return false;
    openedRef.current.add(`guest-${wave}`);
    closeSignupPrompt();
    openSignupPrompt({
      eyebrow: t("eyebrow"),
      title: t("title"),
      body: t("body"),
      benefits: [t("benefit1"), t("benefit2"), t("benefit3")],
      primaryLabel: t("signup"),
      nextPath: pathnameRef.current || "/",
      dismissKey,
    });
    return true;
  };

  useEffect(() => {
    if (loading) return;
    if (user) return;

    const timers: number[] = [];

    if (!sessionFlag(GUEST_FIRST_KEY) && !openedRef.current.has("guest-first")) {
      const screeningOpen = !readFplScreen() && !isFplScreenDismissed();
      timers.push(
        window.setTimeout(() => {
          guestFirstDueRef.current = true;
          openGuestPrompt("first", GUEST_FIRST_KEY);
        }, screeningOpen ? 60_000 : GUEST_FIRST_MS),
      );
    }

    if (!sessionFlag(GUEST_SECOND_KEY) && !openedRef.current.has("guest-second")) {
      timers.push(
        window.setTimeout(() => {
          openGuestPrompt("second", GUEST_SECOND_KEY);
        }, GUEST_SECOND_MS),
      );
    }

    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
    // openGuestPrompt reads latest t/path via refs + current closures from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, openSignupPrompt, closeSignupPrompt, t]);

  // If the 8s wave fired while the guest was on /auth or /pro, retry once they leave.
  useEffect(() => {
    if (loading || user) return;
    if (!guestFirstDueRef.current) return;
    if (sessionFlag(GUEST_FIRST_KEY) || openedRef.current.has("guest-first")) return;
    if (isBlockedPath(pathname)) return;
    openGuestPrompt("first", GUEST_FIRST_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, loading, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!founderPackIsPublic()) return;
    if (profile?.insights_plan === "premium") return;
    if (sessionFlag(SIGNED_IN_PRO_KEY) || openedRef.current.has("signedin-pro")) {
      return;
    }

    const id = window.setTimeout(() => {
      if (sessionFlag(SIGNED_IN_PRO_KEY) || openedRef.current.has("signedin-pro")) {
        return;
      }
      if (isBlockedPath(pathnameRef.current)) return;
      openedRef.current.add("signedin-pro");
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
        primaryHref: FOUNDER_PACK_TEASER_PATH,
        primaryLabel: t("founderCta"),
        nextPath: FOUNDER_PACK_TEASER_PATH,
        dismissKey: SIGNED_IN_PRO_KEY,
      });
    }, SIGNED_IN_PRO_MS);

    return () => window.clearTimeout(id);
  }, [loading, user, profile, openSignupPrompt, closeSignupPrompt, t]);

  return null;
}

export function dismissHomeSignupPrompt(): void {
  try {
    sessionStorage.setItem(GUEST_FIRST_KEY, "1");
    sessionStorage.setItem(GUEST_SECOND_KEY, "1");
    sessionStorage.setItem(SIGNED_IN_PRO_KEY, "1");
  } catch {
    /* ignore */
  }
}
