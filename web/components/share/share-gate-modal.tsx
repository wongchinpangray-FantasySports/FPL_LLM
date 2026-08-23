"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

export function ShareGateModal({
  code,
  href,
  previewOnce,
  labels,
}: {
  code: string;
  href: string;
  previewOnce: boolean;
  labels: {
    title: string;
    bodyOnce: string;
    bodyRepeat: string;
    signup: string;
    login: string;
    stay: string;
  };
}) {
  const [open, setOpen] = useState(!previewOnce);

  useEffect(() => {
    if (!previewOnce) {
      setOpen(true);
      return;
    }
    const t = window.setTimeout(() => setOpen(true), 1400);
    return () => window.clearTimeout(t);
  }, [previewOnce]);

  useEffect(() => {
    if (!previewOnce) return;
    void fetch(`/api/share/${encodeURIComponent(code)}/view`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
  }, [previewOnce, code]);

  if (!open) return null;

  const next = encodeURIComponent(href);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-foreground">{labels.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {previewOnce ? labels.bodyOnce : labels.bodyRepeat}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/auth/signup?next=${next}`}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-medium text-brand-accent-fg no-underline"
          >
            {labels.signup}
          </Link>
          <Link
            href={`/auth/login?next=${next}`}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-border bg-muted px-4 py-2.5 text-sm font-medium text-foreground no-underline"
          >
            {labels.login}
          </Link>
        </div>
        {previewOnce ? (
          <button
            type="button"
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            {labels.stay}
          </button>
        ) : null}
      </div>
    </div>
  );
}
