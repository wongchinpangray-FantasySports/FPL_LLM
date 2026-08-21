"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ScoutChannel, ScoutTrialStats } from "@/lib/scout/types";
import { displayScoutTitle } from "@/lib/scout/zh-status";

type Range = "month" | "previous" | "trial";

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

export function AdminScoutTrialPanel({ locale }: { locale: string }) {
  const t = useTranslations("adminScout");
  const [range, setRange] = useState<Range>("month");
  const [stats, setStats] = useState<ScoutTrialStats | null>(null);
  const [scorecard, setScorecard] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState<ScoutChannel>("wechat");
  const [note, setNote] = useState("");
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/scout/stats?range=${range}`);
      const data = (await res.json()) as {
        stats?: ScoutTrialStats;
        scorecard?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("statsError"));
      setStats(data.stats ?? null);
      setScorecard(data.scorecard ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("statsError"));
    } finally {
      setLoading(false);
    }
  }, [range, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyScorecard() {
    try {
      await navigator.clipboard.writeText(scorecard);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("copyError"));
    }
  }

  async function logPush() {
    setLogging(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/scout/distribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, note }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("logError"));
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("logError"));
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("trialSummary")}</p>

      <div className="flex flex-wrap gap-1">
        {(["month", "previous", "trial"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setRange(tab)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              range === tab
                ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`range.${tab}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-border px-3 py-1.5 text-xs"
        >
          {t("refresh")}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading && !stats ? (
        <p className="text-sm text-muted-foreground">{t("loadingStats")}</p>
      ) : null}

      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label={t("kpiPublished")} value={stats.published_count} />
            <StatCard label={t("kpiPending")} value={stats.pending_count} />
            <StatCard label={t("kpiViews")} value={stats.pageviews} />
            <StatCard label={t("kpiUniques")} value={stats.unique_visitors} />
            <StatCard label={t("kpiPremium")} value={stats.click_premium + stats.click_qr} />
            <StatCard label={t("kpiRater")} value={stats.click_team_rater} />
            <StatCard label={t("kpiOriginal")} value={stats.click_original} />
            <StatCard label={t("kpiDist")} value={stats.distribution_count} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("proUsers", { n: stats.pro_users })}
          </p>

          <div className="scroll-table scroll-table--bordered">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("colArticle")}</th>
                  <th className="px-3 py-2 font-medium">{t("kpiViews")}</th>
                  <th className="px-3 py-2 font-medium">{t("kpiUniques")}</th>
                  <th className="px-3 py-2 font-medium">{t("kpiPremium")}</th>
                  <th className="px-3 py-2 font-medium">{t("kpiRater")}</th>
                  <th className="px-3 py-2 font-medium">{t("kpiOriginal")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.articles.slice(0, 30).map((row) => (
                  <tr key={row.article_id} className="border-t border-border/60">
                    <td className="px-3 py-2">
                      <p className="font-medium">{displayScoutTitle(row)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.status} · {row.slug}
                      </p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.pageviews}</td>
                    <td className="px-3 py-2 tabular-nums">{row.unique_visitors}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.click_premium + row.click_qr}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.click_team_rater}</td>
                    <td className="px-3 py-2 tabular-nums">{row.click_original}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium">{t("logPushTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("logPushHint")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as ScoutChannel)}
                className="rounded-lg border border-border bg-popover px-2 py-2 text-sm"
              >
                <option value="wechat">{t("channel.wechat")}</option>
                <option value="xhs">{t("channel.xhs")}</option>
                <option value="twitter">{t("channel.twitter")}</option>
                <option value="other">{t("channel.other")}</option>
              </select>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("logPushNote")}
                className="min-w-[12rem] flex-1 rounded-lg border border-border bg-popover px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={logging}
                onClick={() => void logPush()}
                className="rounded-lg border border-brand-accent/40 px-3 py-2 text-sm text-brand-accent disabled:opacity-50"
              >
                {t("logPush")}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t("scorecardTitle")}</p>
              <button
                type="button"
                onClick={() => void copyScorecard()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                {copied ? t("copied") : t("copyScorecard")}
              </button>
            </div>
            <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-foreground/90">
              {scorecard}
            </pre>
          </div>
        </>
      ) : null}
      <p className="sr-only">{locale}</p>
    </div>
  );
}
