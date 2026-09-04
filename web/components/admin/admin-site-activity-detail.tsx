"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type {
  SiteActivityStats,
  SiteDailyPoint,
  SiteFeature,
  SiteFeatureStat,
  SiteLoginBucket,
  SiteProductCounts,
} from "@/lib/analytics/types";

export type ActivityDetail =
  | { type: "kpi"; key: KpiKey }
  | { type: "feature"; feature: SiteFeature }
  | { type: "login"; bucket: SiteLoginBucket["bucket"] }
  | { type: "product"; key: keyof SiteProductCounts };

export type KpiKey =
  | "pageviews"
  | "visitors"
  | "signed_in"
  | "views_per_visitor"
  | "total_users"
  | "new_users"
  | "signup_conversion"
  | "dau"
  | "wau"
  | "onboarded"
  | "fpl_linked"
  | "pro"
  | "returning";

type Fact = { label: string; value: string | number };

function fmtDay(isoDate: string, locale: string): string {
  try {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return isoDate.slice(5);
  }
}

function peakDay(
  days: { date: string; value: number }[],
): { date: string; value: number } | null {
  let best: { date: string; value: number } | null = null;
  for (const row of days) {
    if (!best || row.value > best.value) best = row;
  }
  return best && best.value > 0 ? best : null;
}

function MiniSparkline({
  points,
}: {
  points: { date: string; value: number }[];
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="flex h-24 items-end gap-px">
      {points.map((p) => (
        <div
          key={p.date}
          className="min-w-0 flex-1 rounded-t bg-[#00ff87]/85"
          style={{ height: `${Math.max(p.value ? 4 : 0, (p.value / max) * 100)}%` }}
          title={`${p.date}: ${p.value}`}
        />
      ))}
    </div>
  );
}

function Facts({ rows }: { rows: Fact[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-lg border border-border bg-card/50 px-3 py-2"
        >
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {row.label}
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DeltaLine({
  delta,
  current,
}: {
  delta?: number | null;
  current?: number;
}) {
  const t = useTranslations("adminScout.activity");
  if (delta === undefined) return null;
  if (delta === null) {
    if (current != null && current > 0) {
      return (
        <p className="text-sm font-medium text-amber-400">{t("deltaNew")}</p>
      );
    }
    return null;
  }
  const up = delta > 0;
  const down = delta < 0;
  return (
    <p
      className={cn(
        "text-sm font-medium tabular-nums",
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

function kpiFacts(
  stats: SiteActivityStats,
  key: KpiKey,
  locale: string,
  t: ReturnType<typeof useTranslations<"adminScout.activity">>,
): { title: string; summary: string; facts: Fact[]; series: { date: string; value: number }[] } {
  const daily = stats.daily;
  const seriesFor = (pick: (d: SiteDailyPoint) => number) =>
    daily.map((d) => ({ date: d.date, value: pick(d) }));
  const signedPct =
    stats.pageviews > 0
      ? Math.round((stats.signed_in_pageviews / stats.pageviews) * 100)
      : 0;
  const anonVisitors = Math.max(
    0,
    stats.unique_visitors - stats.signed_in_visitors,
  );
  const notOnboarded = Math.max(0, stats.total_users - stats.onboarded_users);
  const notLinked = Math.max(0, stats.total_users - stats.fpl_linked_users);
  const topFeatures = stats.features.slice(0, 5);

  switch (key) {
    case "pageviews": {
      const peak = peakDay(seriesFor((d) => d.pageviews));
      return {
        title: t("kpiPageviews"),
        summary: t("detail.pageviewsSummary", {
          n: stats.pageviews,
          signed: stats.signed_in_pageviews,
          pct: signedPct,
          peak: peak ? fmtDay(peak.date, locale) : "—",
          peakN: peak?.value ?? 0,
        }),
        facts: [
          { label: t("kpiPageviews"), value: stats.pageviews },
          { label: t("detail.signedViews"), value: stats.signed_in_pageviews },
          { label: t("detail.anonViews"), value: stats.anonymous_pageviews },
          {
            label: t("detail.topFeature"),
            value: topFeatures[0]
              ? t(`features.${topFeatures[0].feature}`)
              : "—",
          },
        ],
        series: seriesFor((d) => d.pageviews),
      };
    }
    case "visitors": {
      const peak = peakDay(seriesFor((d) => d.visitors));
      return {
        title: t("kpiVisitors"),
        summary: t("detail.visitorsSummary", {
          n: stats.unique_visitors,
          signed: stats.signed_in_visitors,
          anon: anonVisitors,
          returning: stats.multi_day_visitors,
          peak: peak ? fmtDay(peak.date, locale) : "—",
        }),
        facts: [
          { label: t("kpiVisitors"), value: stats.unique_visitors },
          { label: t("kpiSignedIn"), value: stats.signed_in_visitors },
          { label: t("detail.anonVisitors"), value: anonVisitors },
          { label: t("kpiReturning"), value: stats.multi_day_visitors },
        ],
        series: seriesFor((d) => d.visitors),
      };
    }
    case "signed_in":
      return {
        title: t("kpiSignedIn"),
        summary: t("detail.signedInSummary", {
          n: stats.signed_in_visitors,
          views: stats.signed_in_pageviews,
          pct: signedPct,
        }),
        facts: [
          { label: t("kpiSignedIn"), value: stats.signed_in_visitors },
          { label: t("detail.signedViews"), value: stats.signed_in_pageviews },
          { label: t("detail.anonVisitors"), value: anonVisitors },
          { label: t("kpiViewsPerVisitor"), value: stats.avg_views_per_visitor },
        ],
        series: seriesFor((d) => d.signed_in),
      };
    case "views_per_visitor":
      return {
        title: t("kpiViewsPerVisitor"),
        summary: t("detail.viewsPerVisitorSummary", {
          avg: stats.avg_views_per_visitor,
          views: stats.pageviews,
          visitors: stats.unique_visitors,
        }),
        facts: [
          { label: t("kpiViewsPerVisitor"), value: stats.avg_views_per_visitor },
          { label: t("kpiPageviews"), value: stats.pageviews },
          { label: t("kpiVisitors"), value: stats.unique_visitors },
          { label: t("kpiReturning"), value: stats.multi_day_visitors },
        ],
        series: seriesFor((d) => d.pageviews),
      };
    case "total_users":
      return {
        title: t("kpiTotalUsers"),
        summary: t("detail.totalUsersSummary", {
          n: stats.total_users,
          newN: stats.new_users,
          onboarded: stats.onboarded_users,
        }),
        facts: [
          { label: t("kpiTotalUsers"), value: stats.total_users },
          { label: t("kpiNewUsers"), value: stats.new_users },
          { label: t("kpiOnboarded"), value: stats.onboarded_users },
          { label: t("kpiFplLinked"), value: stats.fpl_linked_users },
        ],
        series: seriesFor((d) => d.new_users),
      };
    case "new_users": {
      const peak = peakDay(seriesFor((d) => d.new_users));
      return {
        title: t("kpiNewUsers"),
        summary: t("detail.newUsersSummary", {
          n: stats.new_users,
          total: stats.total_users,
          peak: peak ? fmtDay(peak.date, locale) : "—",
          peakN: peak?.value ?? 0,
        }),
        facts: [
          { label: t("kpiNewUsers"), value: stats.new_users },
          { label: t("kpiTotalUsers"), value: stats.total_users },
          { label: t("kpiOnboarded"), value: stats.onboarded_users },
          { label: t("kpiFplLinked"), value: stats.fpl_linked_users },
        ],
        series: seriesFor((d) => d.new_users),
      };
    }
    case "signup_conversion":
      return {
        title: t("kpiSignupConversion"),
        summary: t("detail.signupConversionSummary", {
          rate: stats.signup_conversion_rate,
          converted: stats.converted_visitors,
          anon: stats.anonymous_visitors,
          newUsers: stats.new_users,
        }),
        facts: [
          {
            label: t("kpiSignupConversion"),
            value: `${stats.signup_conversion_rate}%`,
          },
          { label: t("detail.anonVisitors"), value: stats.anonymous_visitors },
          {
            label: t("detail.convertedVisitors"),
            value: stats.converted_visitors,
          },
          { label: t("kpiNewUsers"), value: stats.new_users },
        ],
        series: seriesFor((d) => d.new_users),
      };
    case "dau":
      return {
        title: t("kpiDau"),
        summary: t("detail.dauSummary", {
          n: stats.dau,
          logins: stats.active_today,
          visitors: daily.at(-1)?.visitors ?? 0,
        }),
        facts: [
          { label: t("kpiDau"), value: stats.dau },
          { label: t("detail.loginsToday"), value: stats.active_today },
          {
            label: t("detail.visitorsToday"),
            value: daily.at(-1)?.visitors ?? 0,
          },
          { label: t("kpiWau"), value: stats.wau },
        ],
        series: seriesFor((d) => d.visitors),
      };
    case "wau":
      return {
        title: t("kpiWau"),
        summary: t("detail.wauSummary", {
          n: stats.wau,
          mau: stats.mau,
          pct: stats.stickiness,
        }),
        facts: [
          { label: t("kpiWau"), value: stats.wau },
          { label: t("detail.active30d"), value: stats.mau },
          { label: t("kpiDau"), value: stats.dau },
          { label: t("detail.stickiness"), value: `${stats.stickiness}%` },
        ],
        series: seriesFor((d) => d.visitors),
      };
    case "onboarded":
      return {
        title: t("kpiOnboarded"),
        summary: t("detail.onboardedSummary", {
          n: stats.onboarded_users,
          total: stats.total_users,
          left: notOnboarded,
        }),
        facts: [
          { label: t("kpiOnboarded"), value: stats.onboarded_users },
          { label: t("detail.notOnboarded"), value: notOnboarded },
          { label: t("kpiFplLinked"), value: stats.fpl_linked_users },
          { label: t("kpiTotalUsers"), value: stats.total_users },
        ],
        series: seriesFor((d) => d.new_users),
      };
    case "fpl_linked":
      return {
        title: t("kpiFplLinked"),
        summary: t("detail.fplLinkedSummary", {
          n: stats.fpl_linked_users,
          total: stats.total_users,
          left: notLinked,
        }),
        facts: [
          { label: t("kpiFplLinked"), value: stats.fpl_linked_users },
          { label: t("detail.notLinked"), value: notLinked },
          { label: t("kpiOnboarded"), value: stats.onboarded_users },
          { label: t("kpiPro"), value: stats.pro_users },
        ],
        series: seriesFor((d) => d.new_users),
      };
    case "pro":
      return {
        title: t("kpiPro"),
        summary: t("detail.proSummary", {
          n: stats.pro_users,
          total: stats.total_users,
        }),
        facts: [
          { label: t("kpiPro"), value: stats.pro_users },
          { label: t("kpiFplLinked"), value: stats.fpl_linked_users },
          { label: t("kpiOnboarded"), value: stats.onboarded_users },
          { label: t("kpiTotalUsers"), value: stats.total_users },
        ],
        series: [],
      };
    case "returning":
      return {
        title: t("kpiReturning"),
        summary: t("detail.returningSummary", {
          n: stats.multi_day_visitors,
          single: stats.single_day_visitors,
        }),
        facts: [
          { label: t("kpiReturning"), value: stats.multi_day_visitors },
          { label: t("detail.singleDay"), value: stats.single_day_visitors },
          { label: t("kpiVisitors"), value: stats.unique_visitors },
          { label: t("kpiViewsPerVisitor"), value: stats.avg_views_per_visitor },
        ],
        series: seriesFor((d) => d.visitors),
      };
  }
}

function FeatureBody({
  row,
  locale,
  featureLabel,
}: {
  row: SiteFeatureStat;
  locale: string;
  featureLabel: string;
}) {
  const t = useTranslations("adminScout.activity");
  const anon = Math.max(0, row.visitors - row.signed_in);
  const facts: Fact[] = [
    { label: t("kpiPageviews"), value: row.pageviews },
    { label: t("kpiVisitors"), value: row.visitors },
    { label: t("kpiSignedIn"), value: row.signed_in },
    { label: t("detail.anonVisitors"), value: anon },
    { label: t("kpiViewsPerVisitor"), value: row.avg_views_per_visitor },
    { label: t("kpiReturning"), value: row.returning_visitors },
    { label: t("detail.shareOfViews"), value: `${row.share_of_pageviews}%` },
    {
      label: t("detail.peakDay"),
      value: row.peak_date
        ? `${fmtDay(row.peak_date, locale)} · ${row.peak_pageviews}`
        : "—",
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("detail.featureSummary", {
          name: featureLabel,
          views: row.pageviews,
          visitors: row.visitors,
          avg: row.avg_views_per_visitor,
          share: row.share_of_pageviews,
        })}
      </p>
      <DeltaLine delta={row.delta_pageviews} current={row.pageviews} />
      <Facts rows={facts} />
      {row.daily.length > 0 ? (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("sectionDaily")}
          </h4>
          <MiniSparkline
            points={row.daily.map((d) => ({ date: d.date, value: d.pageviews }))}
          />
        </div>
      ) : null}
      {row.paths.length > 0 ? (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.topPaths")}
          </h4>
          <ul className="flex flex-col gap-1.5">
            {row.paths.map((p) => (
              <li
                key={p.path}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate font-mono text-[12px] text-foreground">
                  {p.path}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {p.pageviews} {t("featureViews")}
                  <span className="mx-1 text-border">|</span>
                  {p.visitors} {t("featureVisitors")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AdminSiteActivityDetail({
  stats,
  detail,
  locale,
  featureLabel,
  onClose,
}: {
  stats: SiteActivityStats;
  detail: ActivityDetail | null;
  locale: string;
  featureLabel: (feature: SiteFeature) => string;
  onClose: () => void;
}) {
  const t = useTranslations("adminScout.activity");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (detail) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [detail]);

  const kpi = useMemo(() => {
    if (!detail || detail.type !== "kpi") return null;
    return kpiFacts(stats, detail.key, locale, t);
  }, [detail, locale, stats, t]);

  const featureRow = useMemo(() => {
    if (!detail || detail.type !== "feature") return null;
    return stats.features.find((f) => f.feature === detail.feature) ?? null;
  }, [detail, stats.features]);

  const title = !detail
    ? ""
    : detail.type === "kpi"
      ? kpi?.title ?? ""
      : detail.type === "feature"
        ? featureLabel(detail.feature)
        : detail.type === "login"
          ? t(`loginBucket.${detail.bucket}`)
          : t(`products.${detail.key}`);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="site-activity-detail-title"
      className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none bg-transparent p-3 sm:p-4 [&::backdrop]:bg-black/75 [&:not([open])]:hidden [&[open]]:flex [&[open]]:items-center [&[open]]:justify-center"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div
        className="flex max-h-[min(88vh,760px)] w-[min(96vw,640px)] flex-col overflow-hidden rounded-xl border border-border bg-[rgb(15,12,22)] text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h3
            id="site-activity-detail-title"
            className="text-sm font-semibold text-foreground"
          >
            {title}
          </h3>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => dialogRef.current?.close()}
          >
            {t("detail.close")}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5">
          {detail?.type === "kpi" && kpi ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{kpi.summary}</p>
              <DeltaLine
                delta={
                  detail.key === "pageviews"
                    ? stats.deltas.pageviews
                    : detail.key === "visitors"
                      ? stats.deltas.unique_visitors
                      : detail.key === "signed_in"
                        ? stats.deltas.signed_in_visitors
                        : detail.key === "views_per_visitor"
                          ? stats.deltas.avg_views_per_visitor
                          : detail.key === "total_users"
                            ? stats.deltas.total_users
                            : detail.key === "new_users"
                              ? stats.deltas.new_users
                              : detail.key === "signup_conversion"
                                ? stats.deltas.signup_conversion_rate
                              : detail.key === "dau"
                                ? stats.deltas.dau
                                : detail.key === "wau"
                                  ? stats.deltas.wau
                                  : detail.key === "onboarded"
                                    ? stats.deltas.onboarded_users
                                    : detail.key === "fpl_linked"
                                      ? stats.deltas.fpl_linked_users
                                      : detail.key === "pro"
                                        ? stats.deltas.pro_users
                                        : stats.deltas.multi_day_visitors
                }
              />
              <Facts rows={kpi.facts} />
              {kpi.series.some((p) => p.value > 0) ? (
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("sectionDaily")}
                  </h4>
                  <MiniSparkline points={kpi.series} />
                </div>
              ) : null}
              {detail.key === "pageviews" || detail.key === "visitors" ? (
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("sectionFeatures")}
                  </h4>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {stats.features.slice(0, 8).map((f) => (
                      <li
                        key={f.feature}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="truncate">{featureLabel(f.feature)}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {detail.key === "pageviews" ? f.pageviews : f.visitors}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {detail?.type === "feature" && featureRow ? (
            <FeatureBody
              row={featureRow}
              locale={locale}
              featureLabel={featureLabel(detail.feature)}
            />
          ) : null}

          {detail?.type === "login" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t(`detail.loginSummary.${detail.bucket}`, {
                  n:
                    stats.login_buckets.find((b) => b.bucket === detail.bucket)
                      ?.users ?? 0,
                  pct:
                    stats.total_users > 0
                      ? Math.round(
                          ((stats.login_buckets.find(
                            (b) => b.bucket === detail.bucket,
                          )?.users ?? 0) /
                            stats.total_users) *
                            100,
                        )
                      : 0,
                })}
              </p>
              <Facts
                rows={stats.login_buckets.map((b) => ({
                  label: t(`loginBucket.${b.bucket}`),
                  value: b.users,
                }))}
              />
            </div>
          ) : null}

          {detail?.type === "product" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t(`detail.productSummary.${detail.key}`, {
                  n: stats.products[detail.key],
                })}
              </p>
              <Facts
                rows={[
                  {
                    label: t(`products.${detail.key}`),
                    value: stats.products[detail.key],
                  },
                ]}
              />
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
