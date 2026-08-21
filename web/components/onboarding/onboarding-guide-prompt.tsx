"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "faleague_onboarding_guide_prompt_dismissed";

export function dismissOnboardingGuidePrompt(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private browsing */
  }
}

export function OnboardingGuidePrompt({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  const t = useTranslations("onboarding.guidePrompt");
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissOnboardingGuidePrompt();
        onDismiss();
        router.push("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss, router]);

  function handleDismiss() {
    dismissOnboardingGuidePrompt();
    onDismiss();
    router.push("/");
  }

  function handleReadGuide() {
    dismissOnboardingGuidePrompt();
    onDismiss();
    router.push("/fpl/guide");
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-guide-prompt-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-label={t("close")}
        onClick={handleDismiss}
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
            onClick={handleDismiss}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
            {t("eyebrow")}
          </p>
          <h2
            id="onboarding-guide-prompt-title"
            className="mt-2 pr-8 text-xl font-semibold leading-snug text-foreground sm:text-2xl"
          >
            {t("title")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("body")}</p>

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
            <button
              type="button"
              onClick={handleReadGuide}
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:flex-1")}
            >
              {t("readGuide")}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "w-full sm:flex-1",
              )}
            >
              {t("later")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
