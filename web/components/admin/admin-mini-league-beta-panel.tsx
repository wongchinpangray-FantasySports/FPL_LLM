"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type {
  MiniLeagueBetaInviteRow,
  MiniLeagueFeedbackRow,
} from "@/lib/fpl/mini-league/beta-types";

type SubTab = "invites" | "feedback";

function inviteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function fmtWhen(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AdminMiniLeagueBetaPanel({ locale }: { locale: string }) {
  const t = useTranslations("adminScout.miniLeagueBeta");
  const [sub, setSub] = useState<SubTab>("invites");
  const [invites, setInvites] = useState<MiniLeagueBetaInviteRow[]>([]);
  const [feedback, setFeedback] = useState<MiniLeagueFeedbackRow[]>([]);
  const [currentGw, setCurrentGw] = useState<number | null>(null);
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    pending: 0,
    recommended: 8,
    min: 6,
    max: 10,
  });
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emails, setEmails] = useState("");
  const [extraLinks, setExtraLinks] = useState(0);
  const [duration, setDuration] = useState(5);
  const [startNow, setStartNow] = useState(false);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [createdPaths, setCreatedPaths] = useState<string[]>([]);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mini-league-beta");
      const data = (await res.json()) as {
        invites?: MiniLeagueBetaInviteRow[];
        tableMissing?: boolean;
        currentGw?: number;
        counts?: typeof counts;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("loadError"));
      setInvites(data.invites ?? []);
      setTableMissing(Boolean(data.tableMissing));
      setCurrentGw(data.currentGw ?? null);
      if (data.counts) setCounts(data.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadFeedback = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/mini-league-beta/feedback");
      const data = (await res.json()) as {
        rows?: MiniLeagueFeedbackRow[];
        tableMissing?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("loadError"));
      setFeedback(data.rows ?? []);
      if (data.tableMissing) setTableMissing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    }
  }, [t]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  useEffect(() => {
    if (sub === "feedback") void loadFeedback();
  }, [sub, loadFeedback]);

  async function createInvites(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setCreatedPaths([]);
    try {
      const res = await fetch("/api/admin/mini-league-beta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          extraLinks,
          durationEvents: duration,
          startMode: startNow ? "now" : "on_claim",
          notes,
        }),
      });
      const data = (await res.json()) as {
        invites?: MiniLeagueBetaInviteRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("createError"));
      setEmails("");
      setExtraLinks(0);
      setNotes("");
      setCreatedPaths((data.invites ?? []).map((row) => inviteUrl(row.path)));
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("createError"));
    } finally {
      setCreating(false);
    }
  }

  async function patchInvite(id: string, action: "revoke" | "extend") {
    setError(null);
    try {
      const res = await fetch(`/api/admin/mini-league-beta/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, extraEvents: 5 }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("updateError"));
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("updateError"));
    }
  }

  async function copyText(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError(t("copyError"));
    }
  }

  const sampleHint = useMemo(
    () =>
      t("sampleHint", {
        n: counts.recommended,
        min: counts.min,
        max: counts.max,
      }),
    [counts, t],
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("summary")}</p>
      <p className="text-xs text-muted-foreground">{sampleHint}</p>

      <div className="grid gap-3 sm:grid-cols-4">
        {(
          [
            ["kpiGw", currentGw ? `GW${currentGw}` : "—"],
            ["kpiActive", counts.active],
            ["kpiPending", counts.pending],
            ["kpiTotal", counts.total],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-border bg-card/50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t(key)}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {tableMissing ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {t("needMigration")}
        </p>
      ) : null}

      <div className="flex gap-1">
        {(["invites", "feedback"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              sub === id
                ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t(id === "invites" ? "tabInvites" : "tabFeedback")}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void (sub === "invites" ? loadInvites() : loadFeedback())}
          className="rounded-full border border-border px-3 py-1.5 text-xs"
        >
          {t("refresh")}
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {sub === "invites" ? (
        <>
          <form
            onSubmit={(e) => void createInvites(e)}
            className="rounded-xl border border-border bg-card/40 p-4"
          >
            <h3 className="text-sm font-semibold">{t("createTitle")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("createHint")}</p>
            <label className="mt-3 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t("emailsLabel")}
              </span>
              <textarea
                rows={4}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder={t("emailsPlaceholder")}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("extraLabel")}
                </span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={extraLinks}
                  onChange={(e) => setExtraLinks(Number(e.target.value) || 0)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("durationLabel")}
                </span>
                <input
                  type="number"
                  min={1}
                  max={38}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 5)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={startNow}
                  onChange={(e) => setStartNow(e.target.checked)}
                />
                {t("startNow")}
              </label>
            </div>
            <label className="mt-3 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t("notesLabel")}
              </span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={creating || tableMissing}
              className="mt-3 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60"
            >
              {creating ? t("creating") : t("create")}
            </button>
          </form>

          {createdPaths.length ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{t("createdTitle")}</p>
                <button
                  type="button"
                  className="text-xs text-brand-accent"
                  onClick={() => void copyText(createdPaths.join("\n"), "batch")}
                >
                  {copied === "batch" ? t("copied") : t("copyAll")}
                </button>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {createdPaths.map((url) => (
                  <li key={url} className="break-all font-mono text-muted-foreground">
                    {url}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptyInvites")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("colWho")}</th>
                    <th className="px-3 py-2 font-medium">{t("colStatus")}</th>
                    <th className="px-3 py-2 font-medium">{t("colWindow")}</th>
                    <th className="px-3 py-2 font-medium">{t("colLink")}</th>
                    <th className="px-3 py-2 font-medium">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((row) => (
                    <tr key={row.id} className="border-t border-border/60">
                      <td className="px-3 py-2">
                        <div>{row.email ?? t("magicLink")}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.claimedName || row.claimedBy
                            ? t("claimedAs", {
                                name: row.claimedName ?? row.claimedBy ?? "",
                              })
                            : t("unclaimed")}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px]",
                            row.effectiveStatus === "active"
                              ? "border-emerald-500/30 text-emerald-300"
                              : row.effectiveStatus === "pending"
                                ? "border-amber-500/30 text-amber-200"
                                : "border-border text-muted-foreground",
                          )}
                        >
                          {t(`status.${row.effectiveStatus}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-xs text-muted-foreground">
                        {row.startEvent && row.endEvent
                          ? `GW${row.startEvent}–${row.endEvent}`
                          : t("startsOnClaim")}
                        {row.remainingGws != null
                          ? ` · ${t("left", { n: row.remainingGws })}`
                          : ""}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-xs text-brand-accent"
                          onClick={() => void copyText(inviteUrl(row.path), row.id)}
                        >
                          {copied === row.id ? t("copied") : t("copyLink")}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {row.effectiveStatus !== "revoked" ? (
                            <button
                              type="button"
                              className="text-rose-300"
                              onClick={() => void patchInvite(row.id, "revoke")}
                            >
                              {t("revoke")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="text-muted-foreground"
                            onClick={() => void patchInvite(row.id, "extend")}
                          >
                            {t("extend")}
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {fmtWhen(row.createdAt, locale)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : feedback.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("emptyFeedback")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {feedback.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-border bg-card/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {row.email ?? "—"}
                  {row.gameweek ? ` · GW${row.gameweek}` : ""}
                  {row.toolId ? ` · ${row.toolId}` : ""}
                  {row.rating ? ` · ${row.rating}/5` : ""}
                </span>
                <span>{fmtWhen(row.createdAt, locale)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{row.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
