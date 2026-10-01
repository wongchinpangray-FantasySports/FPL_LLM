"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FOUNDER_PACK_TEASER_PATH,
  SAMPLE_PDF_GATE_SESSION_KEY,
  SAMPLE_TEASER_NUDGE_SESSION_KEY,
  getFounderWechatHandle,
} from "@/lib/billing/founder-pack";

export type SamplePdfGateLabels = {
  sampleDownload: string;
  pdfGateEyebrow: string;
  pdfGateTitle: string;
  pdfGateBody: string;
  pdfGateSignup: string;
  pdfGateWechat: string;
  pdfGateWechatCopied: string;
  pdfGateWechatHint: string;
  pdfGateWechatFallback: string;
  pdfGateDownload: string;
  pdfGateClose: string;
};

function sessionOn(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function sessionSet(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

function markTeaserNudge(): void {
  sessionSet(SAMPLE_TEASER_NUDGE_SESSION_KEY);
}

function modifiedClick(e: React.MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

export function SamplePdfGate({
  href,
  className,
  labels,
  onSignedInDownload,
}: {
  href: string;
  className?: string;
  labels: SamplePdfGateLabels;
  onSignedInDownload?: () => void;
}) {
  const { user, loading } = useAuth();
  const wechat = getFounderWechatHandle();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function dismissGate(): void {
    sessionSet(SAMPLE_PDF_GATE_SESSION_KEY);
    setOpen(false);
  }

  function downloadNow(): void {
    dismissGate();
    window.location.assign(href);
  }

  function onDownloadClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    if (modifiedClick(e)) return;
    if (loading) {
      e.preventDefault();
      return;
    }
    if (user) {
      e.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
      markTeaserNudge();
      onSignedInDownload?.();
      return;
    }
    if (sessionOn(SAMPLE_PDF_GATE_SESSION_KEY)) return;
    e.preventDefault();
    setCopied(false);
    setOpen(true);
  }

  const signupHref = `/auth/signup?next=${encodeURIComponent(FOUNDER_PACK_TEASER_PATH)}`;

  return (
    <>
      <a
        href={href}
        onClick={onDownloadClick}
        className={className}
      >
        {labels.sampleDownload}
      </a>
      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sample-pdf-gate-title"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                aria-label={labels.pdfGateClose}
                onClick={dismissGate}
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
                    onClick={dismissGate}
                    className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={labels.pdfGateClose}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                    {labels.pdfGateEyebrow}
                  </p>
                  <h2
                    id="sample-pdf-gate-title"
                    className="mt-2 pr-8 text-xl font-semibold leading-snug text-foreground sm:text-2xl"
                  >
                    {labels.pdfGateTitle}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {labels.pdfGateBody}
                  </p>

                  <div className="mt-6 flex flex-col gap-2">
                    <Link
                      href={signupHref}
                      onClick={() => {
                        markTeaserNudge();
                        dismissGate();
                      }}
                      className={cn(
                        buttonVariants({ size: "lg" }),
                        "w-full no-underline",
                      )}
                    >
                      {labels.pdfGateSignup}
                    </Link>
                    {wechat ? (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard
                            ?.writeText(wechat)
                            .then(() => setCopied(true))
                            .catch(() => setCopied(false));
                        }}
                        className={cn(
                          buttonVariants({ variant: "secondary", size: "lg" }),
                          "w-full",
                        )}
                      >
                        {copied
                          ? labels.pdfGateWechatCopied
                          : `${labels.pdfGateWechat} ${wechat}`}
                      </button>
                    ) : null}
                    {wechat ? (
                      <p className="text-center text-xs text-muted-foreground">
                        {labels.pdfGateWechatHint}
                      </p>
                    ) : (
                      <p className="text-center text-xs text-muted-foreground">
                        {labels.pdfGateWechatFallback}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={downloadNow}
                    className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
                  >
                    {labels.pdfGateDownload}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
