"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FOUNDER_PACK_PATH, type FounderSkuId } from "@/lib/billing/founder-pack";

export function FounderPackPayActions({
  sku,
  signedInEmail,
  labels,
}: {
  sku: FounderSkuId;
  signedInEmail?: string | null;
  labels: {
    wechatIdLabel: string;
    wechatIdPlaceholder: string;
    contactEmailLabel: string;
    contactEmailPlaceholder: string;
    submit: string;
    submitting: string;
    submitted: string;
    submitError: string;
    alreadyPro: string;
    needWechat: string;
    needEmail: string;
    signupTitle: string;
    signupBody: string;
    signupCta: string;
    signupLater: string;
  };
}) {
  const [wechatId, setWechatId] = useState("");
  const [contactEmail, setContactEmail] = useState(signedInEmail ?? "");
  const [claimState, setClaimState] = useState<
    "idle" | "loading" | "ok" | "pro" | "error"
  >("idle");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [signupEmail, setSignupEmail] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function submit() {
    const id = wechatId.trim();
    const email = (signedInEmail ?? contactEmail).trim().toLowerCase();
    if (!id) {
      setClaimState("error");
      setClaimError(labels.needWechat);
      return;
    }
    if (!email || !email.includes("@")) {
      setClaimState("error");
      setClaimError(labels.needEmail);
      return;
    }

    setClaimState("loading");
    setClaimError(null);
    try {
      const res = await fetch("/api/billing/founder-pack/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wechatId: id,
          sku,
          email: signedInEmail ? undefined : email,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        status?: string;
        needsSignup?: boolean;
      };
      if (res.status === 409 && data.status === "already_premium") {
        setClaimState("pro");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? labels.submitError);
      setClaimState("ok");
      if (data.needsSignup) {
        setSignupEmail(email);
      }
    } catch (e) {
      setClaimState("error");
      setClaimError(e instanceof Error ? e.message : labels.submitError);
    }
  }

  const signupHref = `/auth/signup?next=${encodeURIComponent(FOUNDER_PACK_PATH)}${
    signupEmail ? `&email=${encodeURIComponent(signupEmail)}` : ""
  }`;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">{labels.wechatIdLabel}</span>
        <input
          type="text"
          autoComplete="off"
          value={wechatId}
          onChange={(e) => setWechatId(e.target.value)}
          placeholder={labels.wechatIdPlaceholder}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">
          {labels.contactEmailLabel}
        </span>
        <input
          type="email"
          autoComplete="email"
          value={signedInEmail ?? contactEmail}
          onChange={(e) => {
            if (!signedInEmail) setContactEmail(e.target.value);
          }}
          readOnly={Boolean(signedInEmail)}
          placeholder={labels.contactEmailPlaceholder}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand-accent read-only:opacity-80"
        />
      </label>
      <button
        type="button"
        disabled={claimState === "loading" || claimState === "ok"}
        onClick={() => void submit()}
        className="inline-flex w-fit rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-60"
      >
        {claimState === "loading"
          ? labels.submitting
          : claimState === "ok"
            ? labels.submitted
            : labels.submit}
      </button>
      {claimState === "pro" ? (
        <p className="text-xs text-emerald-300">{labels.alreadyPro}</p>
      ) : null}
      {claimState === "error" && claimError ? (
        <p className="text-xs text-red-400">{claimError}</p>
      ) : null}

      {mounted && signupEmail
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="founder-signup-title"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                aria-label={labels.signupLater}
                onClick={() => setSignupEmail(null)}
              />
              <div className="relative z-[1] w-full max-w-md rounded-2xl border border-brand-accent/25 bg-background p-6 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setSignupEmail(null)}
                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={labels.signupLater}
                >
                  <X className="h-4 w-4" />
                </button>
                <h2
                  id="founder-signup-title"
                  className="pr-8 text-lg font-semibold text-foreground"
                >
                  {labels.signupTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {labels.signupBody.replace("{email}", signupEmail)}
                </p>
                <Link
                  href={signupHref}
                  onClick={() => setSignupEmail(null)}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-ink no-underline hover:opacity-90"
                >
                  {labels.signupCta}
                </Link>
                <button
                  type="button"
                  onClick={() => setSignupEmail(null)}
                  className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  {labels.signupLater}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
