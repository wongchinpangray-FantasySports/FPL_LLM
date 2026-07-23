"use client";

import { useEffect, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignupPrompt } from "@/components/auth/signup-prompt-context";

const STORAGE_KEY = "faleague_signup_prompt_v2_dismissed";
const DELAY_MS = 5000;

/** Home-page signup CTA — shows after 5s for guests on `/`. */
export function HomeSignupPrompt() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";
  const { user, loading } = useAuth();
  const { openSignupPrompt } = useSignupPrompt();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!isHome) return;

    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* private browsing */
    }

    const id = window.setTimeout(() => setArmed(true), DELAY_MS);
    return () => window.clearTimeout(id);
  }, [isHome]);

  useEffect(() => {
    if (!isHome || !armed || loading || user) return;

    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    openSignupPrompt();
  }, [isHome, armed, loading, user, openSignupPrompt]);

  return null;
}

export function dismissHomeSignupPrompt(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}
