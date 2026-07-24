"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type SessionStatus = {
  connected: boolean;
  connected_at: string | null;
};

type Props = {
  entryLinked: boolean;
  initialStatus: SessionStatus;
  onStatusChange?: (status: SessionStatus) => void;
};

export function FplSessionConnectForm({
  entryLinked,
  initialStatus,
  onStatusChange,
}: Props) {
  const t = useTranslations("account");
  const [status, setStatus] = useState(initialStatus);
  const [cookie, setCookie] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useCallback(
    (next: SessionStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  async function connect() {
    if (!entryLinked) {
      setError(t("fplSessionNeedEntry"));
      return;
    }
    const trimmed = cookie.trim();
    if (!trimmed) {
      setError(t("fplSessionEmpty"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/fpl-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_cookie: trimmed }),
      });
      const data = (await res.json()) as SessionStatus & { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("fplSessionConnectFailed"));
      setCookie("");
      updateStatus({
        connected: true,
        connected_at: data.connected_at ?? new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("fplSessionConnectFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/fpl-session", { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("fplSessionDisconnectFailed"));
      updateStatus({ connected: false, connected_at: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("fplSessionDisconnectFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{t("fplSessionTitle")}</h3>
        <span
          className={
            status.connected
              ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-200"
              : "rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
          }
        >
          {status.connected ? t("fplSessionConnected") : t("fplSessionNotConnected")}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("fplSessionHint")}
      </p>
      <button
        type="button"
        className="text-xs text-brand-accent hover:underline"
        onClick={() => setShowHelp((v) => !v)}
      >
        {showHelp ? t("fplSessionHideSteps") : t("fplSessionShowSteps")}
      </button>
      {showHelp ? (
        <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          <li>{t("fplSessionStep1")}</li>
          <li>{t("fplSessionStep2")}</li>
          <li>{t("fplSessionStep3")}</li>
        </ol>
      ) : null}
      {!status.connected ? (
        <>
          <textarea
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            rows={3}
            placeholder={t("fplSessionPlaceholder")}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-[11px] text-foreground"
          />
          <Button
            type="button"
            size="sm"
            disabled={saving || !entryLinked}
            onClick={() => void connect()}
          >
            {saving ? t("fplSessionConnecting") : t("fplSessionConnect")}
          </Button>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {status.connected_at ? (
            <p className="text-xs text-muted-foreground">
              {t("fplSessionConnectedAt", {
                date: new Date(status.connected_at).toLocaleString(),
              })}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={saving}
            onClick={() => void disconnect()}
          >
            {t("fplSessionDisconnect")}
          </Button>
        </div>
      )}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
