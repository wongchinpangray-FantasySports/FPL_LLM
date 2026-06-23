"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "faleague_signup_prompt_v2_dismissed";
const DELAY_MS = 5000;

async function isGuestVisitor(): Promise<boolean> {
  try {
    const res = await fetch("/api/account/me", { credentials: "include" });
    if (!res.ok) return true;
    const data = (await res.json()) as { user?: { id?: string } | null };
    return !data.user?.id;
  } catch {
    return true;
  }
}

/** Home-page signup CTA — mounts from locale layout, shows after 5s for guests. */
export function HomeSignupPrompt() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";

  if (!isHome) return null;

  return <SignupPromptDialog />;
}

function SignupPromptDialog() {
  const t = useTranslations("signupPrompt");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* private browsing */
    }

    const id = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return;

        try {
          if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
        } catch {
          /* ignore */
        }

        const guest = await isGuestVisitor();
        if (!cancelled && guest) {
          setOpen(true);
        }
      })();
    }, DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-prompt-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-label={t("close")}
        onClick={dismiss}
      />
      <div className="relative z-[111] w-full max-w-md overflow-hidden rounded-2xl border border-brand-accent/25 bg-background shadow-2xl shadow-brand-accent/10">
        <div
          className="h-1.5 w-full"
          style={{
            background:
              "linear-gradient(90deg, var(--team-primary, var(--brand-accent)), var(--team-secondary, #37003c))",
          }}
        />
        <div className="p-6 sm:p-7">
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
            {t("eyebrow")}
          </p>
          <h2
            id="signup-prompt-title"
            className="mt-2 pr-8 text-xl font-semibold leading-snug text-foreground sm:text-2xl"
          >
            {t("title")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("body")}
          </p>

          <ul className="mt-4 space-y-2 text-sm text-foreground/85">
            <li className="flex gap-2">
              <span className="text-brand-accent" aria-hidden>
                ✓
              </span>
              {t("benefit1")}
            </li>
            <li className="flex gap-2">
              <span className="text-brand-accent" aria-hidden>
                ✓
              </span>
              {t("benefit2")}
            </li>
            <li className="flex gap-2">
              <span className="text-brand-accent" aria-hidden>
                ✓
              </span>
              {t("benefit3")}
            </li>
          </ul>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/auth/signup"
              onClick={dismiss}
              className={cn(buttonVariants({ size: "lg" }), "w-full no-underline sm:flex-1")}
            >
              {t("signup")}
            </Link>
            <Link
              href="/auth/login"
              onClick={dismiss}
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "w-full no-underline sm:flex-1",
              )}
            >
              {t("signin")}
            </Link>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {t("dismiss")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
