"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

export function AuthForm({
  mode,
  nextPath,
}: {
  mode: Mode;
  nextPath?: string;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup" && password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }
    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    setLoading(true);
    try {
      const supa = createSupabaseBrowserClient();
      if (mode === "signup") {
        const { error: signUpError } = await supa.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        router.push("/onboarding");
        return;
      }

      const { error: signInError } = await supa.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      const meRes = await fetch("/api/account/me");
      const me = (await meRes.json()) as {
        profile?: { onboarding_completed_at?: string | null } | null;
      };
      if (!me.profile?.onboarding_completed_at) {
        router.push("/onboarding");
        return;
      }

      const dest = nextPath?.startsWith("/") ? nextPath : "/dashboard";
      router.push(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className={cn(
        "mx-auto w-full max-w-md rounded-xl border border-white/[0.08]",
        "bg-white/[0.03] p-6 shadow-xl",
      )}
    >
      <h1 className="text-xl font-semibold text-white">
        {mode === "signup" ? t("signupTitle") : t("loginTitle")}
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        {mode === "signup" ? t("signupSubtitle") : t("loginSubtitle")}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-slate-400">{t("email")}</span>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-slate-400">{t("password")}</span>
          <Input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === "signup" ? (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-slate-400">{t("confirmPassword")}</span>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="mt-6 w-full" disabled={loading}>
        {loading
          ? t("loading")
          : mode === "signup"
            ? t("signupButton")
            : t("loginButton")}
      </Button>
    </form>
  );
}
