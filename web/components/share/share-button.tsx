"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Share2, Copy, Check, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({
  path,
  title,
  refId,
  compact,
}: {
  path: string;
  title: string;
  refId?: string;
  compact?: boolean;
}) {
  const t = useTranslations("share");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createLink() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ path, title, ref_id: refId }),
      });
      const data = (await res.json()) as {
        url?: string;
        code?: string;
        error?: string;
      };
      if (!res.ok || !data.url || !data.code) {
        throw new Error(data.error ?? t("error"));
      }
      setUrl(data.url);
      setCode(data.code);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError(t("error"));
    }
  }

  async function nativeShare() {
    if (!url || typeof navigator.share !== "function") {
      await copyUrl();
      return;
    }
    try {
      await navigator.share({ title, url });
    } catch {
      /* cancelled */
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={compact ? "h-7 gap-1 px-2 text-[11px]" : undefined}
        disabled={busy}
        onClick={() => void createLink()}
      >
        <Share2 className="h-3.5 w-3.5" />
        {t("share")}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-foreground">{t("share")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("hint")}</p>
            {error ? (
              <p className="mt-3 text-sm text-red-400">{error}</p>
            ) : null}
            {url ? (
              <>
                <p className="mt-3 break-all rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
                  {url}
                </p>
                {code ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/share/${code}/qr`}
                    alt=""
                    width={200}
                    height={200}
                    className="mx-auto mt-4 rounded-lg bg-white p-2"
                  />
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void nativeShare()}>
                    <Share2 className="h-3.5 w-3.5" />
                    {t("share")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void copyUrl()}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? t("copied") : t("copy")}
                  </Button>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <QrCode className="h-3.5 w-3.5" />
                    {t("qr")}
                  </span>
                </div>
              </>
            ) : null}
            <button
              type="button"
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              {t("close")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
