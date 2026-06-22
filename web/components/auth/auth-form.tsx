"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

async function authRequest(
  mode: Mode,
  email: string,
  password: string,
): Promise<{ error?: string }> {
  const res = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) return { error: data.error ?? "Request failed" };
  return {};
}

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
      const trimmed = email.trim();
      const result = await authRequest(mode, trimmed, password);
      if (result.error) throw new Error(result.error);

      if (mode === "signup") {
        router.push("/onboarding");
        return;
      }

      await new Promise((r) => setTimeout(r, 200));
      let meRes = await fetch("/api/account/me");
      if (!meRes.ok) {
        await new Promise((r) => setTimeout(r, 300));
        meRes = await fetch("/api/account/me");
      }
      const me = (await meRes.json()) as {
        user?: { id: string } | null;
        profile?: { onboarding_completed_at?: string | null } | null;
      };
      if (me.user && !me.profile?.onboarding_completed_at) {
        router.push("/onboarding");
        return;
      }

      const dest = nextPath?.startsWith("/") ? nextPath : "/";
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
        "mx-auto w-full max-w-md rounded-xl border border-border",
        "bg-card p-6 shadow-xl",
      )}
    >
      <h1 className="text-xl font-semibold text-foreground">
        {mode === "signup" ? t("signupTitle") : t("loginTitle")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "signup" ? t("signupSubtitle") : t("loginSubtitle")}
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
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t("password")}</span>
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
