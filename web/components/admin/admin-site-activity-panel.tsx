"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type {
  SiteActivityStats,
  SiteDailyPoint,
  SiteFeature,
} from "@/lib/analytics/types";

type Range = 7 | 30 | 90;

function StatCard({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: number | string;
  hint?: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <DeltaLabel delta={delta} current={typeof value === "number" ? value : null} />
      {hint ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function DeltaLabel({
  delta,
  current,
}: {
  delta?: number | null;
  current?: number | null;
}) {
  const t = useTranslations("adminScout.activity");
  if (delta === undefined) return null;
  if (delta === null) {
    if (current != null && current > 0) {
      return (
        <p className="mt-0.5 text-[11px] font-medium text-amber-400">
          {t("deltaNew")}
        </p>
      );
    }
    return null;
  }
  const up = delta > 0;
  const down = delta < 0;
  return (
    <p
      className={cn(
        "mt-0.5 text-[11px] font-medium tabular-nums",
        up && "text-emerald-400",
        down && "text-rose-400",
        !up && !down && "text-muted-foreground",
      )}
    >
      {up ? "+" : ""}
      {delta}% {t("vsPrevious")}
    </p>
  );
}

function fmtDay(isoDate: string, locale: string): string {
  try {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
      new Date(Date.UTC(y, m - 1, d)),
    );
  } catch {
    return isoDate.slice(5);
  }
}

function DailyChart({
  days,
  locale,
  labels,
}: {
  days: SiteDailyPoint[];
  locale: string;
  labels: { views: string; visitors: string; joiners: string };
}) {
  const max = Math.max(1, ...days.map((d) => Math.max(d.pageviews, d.visitors, d.new_users)));
  const tickEvery = days.length > 40 ? 14 : days.length > 14 ? 7 : 1;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#00ff87]" />
          {labels.views}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
          {labels.visitors}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-400" />
          {labels.joiners}
        </span>
      </div>
      <div className="flex h-40 items-end gap-px sm:gap-0.5">
        {days.map((d) => (
          <div
            key={d.date}
            className="flex min-w-0 flex-1 flex-col items-center justify-end"
            title={`${d.date}: ${d.pageviews} ${labels.views}, ${d.visitors} ${labels.visitors}, ${d.new_users} ${labels.joiners}`}
          >
            <div className="flex h-32 w-full items-end justify-center gap-px">
              <div
                className="w-[40%] max-w-[10px] rounded-t bg-[#00ff87]"
                style={{ height: `${Math.max(d.pageviews ? 4 : 0, (d.pageviews / max) * 100)}%` }}
              />
              <div
                className="w-[30%] max-w-[8px] rounded-t bg-amber-400"
                style={{ height: `${Math.max(d.visitors ? 3 : 0, (d.visitors / max) * 100)}%` }}
              />
              <div
                className="w-[25%] max-w-[7px] rounded-t bg-violet-400"
                style={{ height: `${Math.max(d.new_users ? 3 : 0, (d.new_users / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {days.map((d, i) =>
          i === 0 || i === days.length - 1 || i % tickEvery === 0 ? (
            <span key={d.date} className="min-w-0 truncate">
              {fmtDay(d.date, locale)}
            </span>
          ) : (
            <span key={d.date} className="min-w-0 flex-1" />
          ),
        )}
      </div>
    </div>
  );
}

function FeatureBar({
  features,
  labelFor,
  viewsLabel,
  visitorsLabel,
}: {
  features: SiteActivityStats["features"];
  labelFor: (feature: SiteFeature) => string;
  viewsLabel: string;
  visitorsLabel: string;
}) {
  const max = Math.max(1, ...features.map((f) => f.pageviews));
  if (features.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {features.slice(0, 16).map((row) => (
        <div key={row.feature}>
          <div className="mb-0.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium">{labelFor(row.feature)}</span>
            <span className="shrink-0 text-right text-[11px] leading-snug text-muted-foreground">
              <span className="tabular-nums text-foreground">
                {row.pageviews}
              </span>{" "}
              {viewsLabel}
              <span className="mx-1 text-border">|</span>
              <span className="tabular-nums text-foreground">
                {row.visitors}
              </span>{" "}
              {visitorsLabel}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#00ff87]/80"
              style={{ width: `${Math.max(4, (row.pageviews / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminSiteActivityPanel({ locale }: { locale: string }) {
  const t = useTranslations("adminScout.activity");
  const [days, setDays] = useState<Range>(30);
  const [stats, setStats] = useState<SiteActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/site-stats?days=${days}`);
      const data = (await res.json()) as {
        stats?: SiteActivityStats;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("loadError"));
      setStats(data.stats ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [days, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const featureLabel = useCallback(
    (feature: SiteFeature) => {
      try {
        return t(`features.${feature}`);
      } catch {
        return feature;
      }
    },
    [t],
  );

  const onboardedPct = useMemo(() => {
    if (!stats || stats.total_users === 0) return "0%";
    return `${Math.round((stats.onboarded_users / stats.total_users) * 100)}%`;
  }, [stats]);

  const linkedPct = useMemo(() => {
    if (!stats || stats.total_users === 0) return "0%";
    return `${Math.round((stats.fpl_linked_users / stats.total_users) * 100)}%`;
  }, [stats]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("summary")}</p>

      <div className="flex flex-wrap gap-1">
        {([7, 30, 90] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setDays(tab)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              days === tab
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

      {stats?.table_missing ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {t("needMigration")}
        </p>
      ) : null}

      {stats?.truncated ? (
        <p className="text-xs text-muted-foreground">{t("truncated")}</p>
      ) : null}

      {loading && !stats ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : null}

      {stats ? (
        <>
          <div>
            <h3 className="mb-2 text-sm font-medium">{t("sectionTraffic")}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard
                label={t("kpiPageviews")}
                value={stats.pageviews}
                delta={stats.deltas?.pageviews}
              />
              <StatCard
                label={t("kpiVisitors")}
                value={stats.unique_visitors}
                delta={stats.deltas?.unique_visitors}
              />
              <StatCard
                label={t("kpiSignedIn")}
                value={stats.signed_in_visitors}
                hint={t("kpiSignedInHint", { n: stats.signed_in_pageviews })}
                delta={stats.deltas?.signed_in_visitors}
              />
              <StatCard
                label={t("kpiViewsPerVisitor")}
                value={stats.avg_views_per_visitor}
                delta={stats.deltas?.avg_views_per_visitor}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">{t("sectionUsers")}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard
                label={t("kpiTotalUsers")}
                value={stats.total_users}
                delta={stats.deltas?.total_users}
              />
              <StatCard
                label={t("kpiNewUsers")}
                value={stats.new_users}
                delta={stats.deltas?.new_users}
              />
              <StatCard
                label={t("kpiDau")}
                value={stats.dau}
                hint={t("kpiDauHint")}
                delta={stats.deltas?.dau}
              />
              <StatCard
                label={t("kpiWau")}
                value={stats.wau}
                hint={t("kpiMauHint", { n: stats.mau, pct: stats.stickiness })}
                delta={stats.deltas?.wau}
              />
              <StatCard
                label={t("kpiOnboarded")}
                value={stats.onboarded_users}
                hint={onboardedPct}
                delta={stats.deltas?.onboarded_users}
              />
              <StatCard
                label={t("kpiFplLinked")}
                value={stats.fpl_linked_users}
                hint={linkedPct}
                delta={stats.deltas?.fpl_linked_users}
              />
              <StatCard
                label={t("kpiPro")}
                value={stats.pro_users}
                delta={stats.deltas?.pro_users}
              />
              <StatCard
                label={t("kpiReturning")}
                value={stats.multi_day_visitors}
                hint={t("kpiReturningHint", { n: stats.single_day_visitors })}
                delta={stats.deltas?.multi_day_visitors}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-3">
            <h3 className="mb-3 text-sm font-medium">{t("sectionDaily")}</h3>
            <DailyChart
              days={stats.daily}
              locale={locale}
              labels={{
                views: t("kpiPageviews"),
                visitors: t("kpiVisitors"),
                joiners: t("kpiNewUsers"),
              }}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <h3 className="mb-1 text-sm font-medium">{t("sectionFeatures")}</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                {t("featuresHint")}
              </p>
              {stats.features.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noPageviews")}</p>
              ) : (
                <FeatureBar
                  features={stats.features}
                  labelFor={featureLabel}
                  viewsLabel={t("featureViews")}
                  visitorsLabel={t("featureVisitors")}
                />
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-border bg-card/40 p-3">
                <h3 className="mb-1 text-sm font-medium">{t("sectionActivity")}</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("activityHint")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {stats.login_buckets.map((row) => (
                    <StatCard
                      key={row.bucket}
                      label={t(`loginBucket.${row.bucket}`)}
                      value={row.users}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/40 p-3">
                <h3 className="mb-1 text-sm font-medium">{t("sectionProducts")}</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("productsHint")}
                </p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  {(
                    [
                      ["squad_builder_drafts", stats.products.squad_builder_drafts],
                      ["chat_sessions", stats.products.chat_sessions],
                      ["chat_messages", stats.products.chat_messages],
                      ["mini_entries", stats.products.mini_entries],
                      ["mini_profiles", stats.products.mini_profiles],
                      ["share_links", stats.products.share_links],
                      ["share_views", stats.products.share_views],
                      ["scout_pageviews", stats.products.scout_pageviews],
                    ] as const
                  ).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t(`products.${key}`)}
                      </dt>
                      <dd className="tabular-nums font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
