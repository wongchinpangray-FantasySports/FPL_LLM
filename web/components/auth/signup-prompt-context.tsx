"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SignupPromptCopy = {
  title?: string;
  body?: string;
};

type SignupPromptContextValue = {
  openSignupPrompt: (copy?: SignupPromptCopy) => void;
  closeSignupPrompt: () => void;
};

const SignupPromptContext = createContext<SignupPromptContextValue | null>(null);

export function useSignupPrompt(): SignupPromptContextValue {
  const ctx = useContext(SignupPromptContext);
  if (!ctx) {
    return {
      openSignupPrompt: () => {},
      closeSignupPrompt: () => {},
    };
  }
  return ctx;
}

export function SignupPromptProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<SignupPromptCopy | null>(null);

  const openSignupPrompt = useCallback((next?: SignupPromptCopy) => {
    setCopy(next ?? null);
    setOpen(true);
  }, []);

  const closeSignupPrompt = useCallback(() => {
    setOpen(false);
    setCopy(null);
  }, []);

  const value = useMemo(
    () => ({ openSignupPrompt, closeSignupPrompt }),
    [openSignupPrompt, closeSignupPrompt],
  );

  return (
    <SignupPromptContext.Provider value={value}>
      {children}
      {open ? <SignupPromptDialog copy={copy} onClose={closeSignupPrompt} /> : null}
    </SignupPromptContext.Provider>
  );
}

function SignupPromptDialog({
  copy,
  onClose,
}: {
  copy: SignupPromptCopy | null;
  onClose: () => void;
}) {
  const t = useTranslations("signupPrompt");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const title = copy?.title ?? t("title");
  const body = copy?.body ?? t("body");

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
        onClick={onClose}
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
            onClick={onClose}
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
            {title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>

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
              onClick={onClose}
              className={cn(buttonVariants({ size: "lg" }), "w-full no-underline sm:flex-1")}
            >
              {t("signup")}
            </Link>
            <Link
              href="/auth/login"
              onClick={onClose}
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
            onClick={() => {
              if (!copy) {
                try {
                  sessionStorage.setItem("faleague_signup_prompt_v2_dismissed", "1");
                } catch {
                  /* ignore */
                }
              }
              onClose();
            }}
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
