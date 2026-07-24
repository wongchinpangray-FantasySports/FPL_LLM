"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getPathname, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AccountMe = {
  user?: { id: string } | null;
};

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/account/me", { credentials: "include" });
        if (!res.ok) throw new Error("no session");
        const data = (await res.json()) as AccountMe;
        if (!cancelled) {
          setSessionValid(Boolean(data.user?.id));
        }
      } catch {
        if (!cancelled) setSessionValid(false);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }
    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    setLoading(true);
    let redirecting = false;
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? t("genericError"));
      }
      redirecting = true;
      window.location.assign(getPathname({ locale, href: "/" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      if (!redirecting) setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div
        className={cn(
          "mx-auto w-full max-w-md rounded-xl border border-border",
          "bg-card p-6 shadow-xl text-sm text-muted-foreground",
        )}
      >
        {t("loading")}
      </div>
    );
  }

  if (!sessionValid) {
    return (
      <div
        className={cn(
          "mx-auto w-full max-w-md rounded-xl border border-border",
          "bg-card p-6 shadow-xl",
        )}
      >
        <h1 className="text-xl font-semibold text-foreground">
          {t("resetPasswordTitle")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("resetLinkExpired")}
        </p>
        <Link
          href="/auth/forgot-password"
          className="mt-6 inline-block text-sm text-brand-accent hover:underline"
        >
          {t("requestNewResetLink")}
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
        {t("resetPasswordTitle")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("resetPasswordSubtitle")}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t("newPassword")}</span>
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t("confirmPassword")}</span>
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="mt-6 w-full" disabled={loading}>
        {loading ? t("loading") : t("updatePasswordButton")}
      </Button>
    </form>
  );
}
