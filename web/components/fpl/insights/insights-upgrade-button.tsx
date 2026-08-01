"use client";

import { useState } from "react";

export function InsightsUpgradeButton({
  label,
  returnPath,
  locale,
  variant = "primary",
  disabled,
}: {
  label: string;
  returnPath?: string;
  locale?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/insights/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath, locale }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Checkout failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
    }
  }

  const className =
    variant === "primary"
      ? "inline-flex rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-60"
      : "inline-flex rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-60";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={className}
        disabled={disabled || loading}
        onClick={() => void startCheckout()}
      >
        {loading ? "…" : label}
      </button>
      {error ? (
        <span className="text-xs text-red-400">{error}</span>
      ) : null}
    </div>
  );
}

export function InsightsManageBillingButton({
  label,
  returnPath,
  disabled,
}: {
  label: string;
  returnPath?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/insights/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Portal failed");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Portal failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className="inline-flex rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-60"
        disabled={disabled || loading}
        onClick={() => void openPortal()}
      >
        {loading ? "…" : label}
      </button>
      {error ? (
        <span className="text-xs text-red-400">{error}</span>
      ) : null}
    </div>
  );
}
