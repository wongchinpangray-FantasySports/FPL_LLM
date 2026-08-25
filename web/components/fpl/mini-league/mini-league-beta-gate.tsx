"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { MiniLeagueFeedbackForm } from "@/components/fpl/mini-league/mini-league-beta-banner";

const BETA_ERROR_KEYS = [
  "short",
  "long",
  "forbidden",
  "rate_limited",
  "missing_table",
  "invalid",
  "revoked",
  "taken",
] as const;

function betaErrorMessage(
  t: ReturnType<typeof useTranslations<"miniLeague.beta">>,
  code: string | undefined,
  fallback: string,
): string {
  if (code && (BETA_ERROR_KEYS as readonly string[]).includes(code)) {
    return t(`errors.${code as (typeof BETA_ERROR_KEYS)[number]}`);
  }
  return fallback;
}

export function MiniLeagueBetaGate({
  signedIn,
  reason,
  claimError,
  inviteToken,
  returnPath,
}: {
  signedIn: boolean;
  reason: "unauthenticated" | "beta_required" | "expired" | "revoked" | "premium_required";
  claimError?: string | null;
  inviteToken?: string | null;
  returnPath: string;
}) {
  const t = useTranslations("miniLeague.beta");
  const [token, setToken] = useState(inviteToken ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    claimError ? betaErrorMessage(t, claimError, t("claimError")) : null,
  );

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    if (!signedIn) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fpl/mini-league/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(betaErrorMessage(t, data.error, t("claimError")));
      }
      window.location.assign(returnPath.split("?")[0] || "/fpl/mini-league");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("claimError"));
    } finally {
      setBusy(false);
    }
  }

  const expired = reason === "expired";
  const loginHref = `/auth/login?next=${encodeURIComponent(returnPath)}`;

  return (
    <div className="rounded-xl border border-amber-500/25 bg-card px-4 py-5 sm:px-6">
      <h3 className="text-base font-semibold text-foreground">
        {expired ? t("expiredTitle") : t("gateTitle")}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {expired ? t("expiredBody") : signedIn ? t("gateBodySignedIn") : t("gateBody")}
      </p>

      {!signedIn ? (
        <Link
          href={loginHref}
          className="mt-4 inline-flex rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-ink no-underline hover:opacity-90"
        >
          {t("signIn")}
        </Link>
      ) : !expired ? (
        <form onSubmit={(e) => void claim(e)} className="mt-4 flex max-w-lg flex-col gap-2 sm:flex-row">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t("codePlaceholder")}
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={busy || token.trim().length < 6}
            className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60"
          >
            {busy ? t("claiming") : t("claim")}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {expired && signedIn ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium">{t("expiredFeedback")}</p>
          <MiniLeagueFeedbackForm />
        </div>
      ) : null}
    </div>
  );
}
