"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError(t("invalidEmail"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: trimmed, locale }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? t("genericError"));
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div
        className={cn(
          "mx-auto w-full max-w-md rounded-xl border border-border",
          "bg-card p-6 shadow-xl",
        )}
      >
        <h1 className="text-xl font-semibold text-foreground">
          {t("forgotPasswordTitle")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("resetEmailSent")}
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-block text-sm text-brand-accent hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className={cn(
        "mx-auto w-full max-w-md rounded-xl border border-border",
        "bg-card p-6 shadow-xl",
      )}
    >
      <h1 className="text-xl font-semibold text-foreground">
        {t("forgotPasswordTitle")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("forgotPasswordSubtitle")}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t("email")}</span>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="mt-6 w-full" disabled={loading}>
        {loading ? t("loading") : t("sendResetLink")}
      </Button>
    </form>
  );
}
