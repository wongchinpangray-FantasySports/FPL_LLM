"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { EntryIdForm } from "@/components/entry-id-form";
import { useEntryId } from "@/components/entry-id-context";
import { useAuth } from "@/components/auth/auth-provider";
import { ShareButton } from "@/components/share/share-button";
import { HomeRankSparkline } from "@/components/home/home-rank-sparkline";
import { cn } from "@/lib/utils";
import type { RankHistoryPoint } from "@/lib/fpl-rank-series";

type HealthFlag = {
  fpl_id: number;
  web_name: string;
  kind: "injured" | "doubtful" | "suspended" | "unavailable" | "news";
  note: string;
};

type StarterRow = {
  fpl_id: number;
  name: string;
  position?: string;
  team?: string;
};

type TeamSummary = {
  entry?: {
    name?: string;
    player_first_name?: string;
    player_last_name?: string;
    summary_overall_rank?: number | null;
    summary_overall_points?: number | null;
    current_event?: number | null;
  };
  picks_gw?: number | null;
  current_gw?: number | null;
  last_gw?: number | null;
  last_gw_points?: number | null;
  last_gw_rank?: number | null;
  prev_gw_rank?: number | null;
  rank_delta?: number | null;
  rank_history?: RankHistoryPoint[];
  average_rank?: number | null;
  bank?: number | null;
  team_value?: number | null;
  free_transfers?: number | null;
  active_chip?: string | null;
  squad?: {
    count?: number;
    captain?: string | null;
    starters?: StarterRow[] | string[];
    starter_names?: string[];
  };
  health?: {
    status: "good" | "watch" | "alert";
    flags: HealthFlag[];
    available_starters: number;
    starter_count: number;
  };
};

function teamDisplayName(s: TeamSummary, entryId: string): string {
  const e = s.entry;
  if (e?.name?.trim()) return e.name.trim();
  const parts = [e?.player_first_name, e?.player_last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return `#${entryId}`;
}

function starterNames(s: TeamSummary): string[] {
  if (s.squad?.starter_names?.length) return s.squad.starter_names;
  const starters = s.squad?.starters ?? [];
  return starters.map((row) => (typeof row === "string" ? row : row.name));
}

function formatMoney(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `£${n.toFixed(1)}m`;
}

function formatChip(chip: string | null | undefined): string | null {
  if (!chip) return null;
  const map: Record<string, string> = {
    bboost: "BB",
    freehit: "FH",
    wildcard: "WC",
    "3xc": "TC",
  };
  return map[chip.toLowerCase()] ?? chip.toUpperCase();
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/60 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          accent ? "text-brand-accent" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function SectionShell({
  eyebrow,
  title,
  titleHref,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  titleHref?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-brand-accent">
            {eyebrow}
          </p>
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            {titleHref ? (
              <Link
                href={titleHref}
                className="no-underline hover:text-brand-accent"
              >
                {title}
                <span className="ml-1.5 text-sm font-medium text-brand-accent">
                  →
                </span>
              </Link>
            ) : (
              title
            )}
          </h2>
          {description ? (
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ToolGroup({
  title,
  items,
  footer,
}: {
  title: string;
  items: { href: string; label: string; body: string }[];
  footer?: ReactNode;
}) {
  if (items.length === 0 && !footer) return null;
  return (
    <div className="rounded-xl border border-border bg-card/40">
      <h3 className="border-b border-border/70 px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul>
        {items.map((item) => (
          <li key={item.href} className="border-b border-border/50 last:border-0">
            <Link
              href={item.href}
              className="group flex items-start justify-between gap-3 px-3.5 py-2.5 no-underline transition-colors hover:bg-muted/40"
            >
              <span>
                <span className="block text-sm font-medium text-foreground group-hover:text-brand-accent">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {item.body}
                </span>
              </span>
              <span className="shrink-0 pt-0.5 text-muted-foreground group-hover:text-brand-accent">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {footer}
    </div>
  );
}

function PlanBuildCard({
  title,
  body,
  plannerHref,
  plannerLabel,
  builderHref,
  builderLabel,
}: {
  title: string;
  body: string;
  plannerHref: string;
  plannerLabel: string;
  builderHref: string;
  builderLabel: string;
}) {
  return (
    <div className="border-b border-border/50 px-3.5 py-2.5 last:border-0">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href={plannerHref}
          className="rounded-md border border-brand-accent/35 bg-brand-accent/10 px-2.5 py-1 text-xs font-medium text-brand-accent no-underline hover:bg-brand-accent/20"
        >
          {plannerLabel}
        </Link>
        <Link
          href={builderHref}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground no-underline hover:border-brand-accent/40 hover:text-brand-accent"
        >
          {builderLabel}
        </Link>
      </div>
    </div>
  );
}

function useTeamSummary() {
  const { entryId } = useEntryId();
  const t = useTranslations("home");
  const [data, setData] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entryId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/team/${entryId}/summary`)
      .then(async (res) => {
        const json = (await res.json()) as TeamSummary & { error?: string };
        if (!res.ok) throw new Error(json.error ?? t("fplSnapshotError"));
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : t("fplSnapshotError"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entryId, t]);

  return { entryId, data, loading, error };
}

function PerformanceBlock({
  entryId,
  data,
  loading,
  error,
}: {
  entryId: string | null;
  data: TeamSummary | null;
  loading: boolean;
  error: string | null;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const { profile } = useAuth();
  const { setEntryId } = useEntryId();
  const defaultEntryId =
    profile?.fpl_entry_id != null ? String(profile.fpl_entry_id) : null;
  const viewingOther =
    entryId != null &&
    defaultEntryId != null &&
    entryId !== defaultEntryId;

  return (
    <SectionShell
      eyebrow={t("seasonPerfEyebrow")}
      title={t("seasonPerfTitle")}
      description={t("seasonPerfDescription")}
    >
      <div className="home-hub-card home-hub-card-hero rounded-xl border">
        <div aria-hidden className="home-hub-glow-primary" />
        <div aria-hidden className="home-hub-glow-secondary" />
        <div className="home-hub-card-inner flex flex-col gap-4 px-4 py-4">
          <div>
            <EntryIdForm
              redirectTo={(id) => `/dashboard/${id}`}
              showQuickLinks={false}
            />
            <p className="mt-2 text-xs text-muted-foreground">{t("entryHint")}</p>
            {viewingOther ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-100/90">
                <span>{t("entryViewingOther", { id: entryId })}</span>
                <button
                  type="button"
                  className="font-medium text-brand-accent underline decoration-brand-accent/40 underline-offset-2 hover:text-brand-accent/90"
                  onClick={() => setEntryId(defaultEntryId)}
                >
                  {t("entryUseDefault", { id: defaultEntryId })}
                </button>
              </div>
            ) : null}
          </div>

          {!entryId ? (
            <p className="text-sm text-muted-foreground">{t("seasonPerfBind")}</p>
          ) : loading ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg border border-border bg-muted/40"
                />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : data ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {teamDisplayName(data, entryId)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {formatChip(data.active_chip) ? (
                    <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-foreground">
                      {t("seasonPerfChip", { chip: formatChip(data.active_chip)! })}
                    </span>
                  ) : null}
                  <ShareButton
                    compact
                    path={`/manager/${entryId}`}
                    title={t("seasonPerfShareTitle", {
                      team: teamDisplayName(data, entryId),
                    })}
                    refId={entryId}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label={t("seasonPerfOverallRank")}
                  value={
                    data.entry?.summary_overall_rank != null
                      ? data.entry.summary_overall_rank.toLocaleString(locale)
                      : "—"
                  }
                  hint={
                    data.rank_delta != null && data.rank_delta !== 0
                      ? data.rank_delta > 0
                        ? t("seasonPerfRankUp", {
                            n: data.rank_delta.toLocaleString(locale),
                          })
                        : t("seasonPerfRankDown", {
                            n: Math.abs(data.rank_delta).toLocaleString(locale),
                          })
                      : undefined
                  }
                  accent
                />
                <Metric
                  label={t("seasonPerfTotalPts")}
                  value={
                    data.entry?.summary_overall_points != null
                      ? String(data.entry.summary_overall_points)
                      : "—"
                  }
                />
                <Metric
                  label={
                    data.last_gw != null
                      ? t("seasonPerfGwPts", { gw: String(data.last_gw) })
                      : t("seasonPerfLastGw")
                  }
                  value={
                    data.last_gw_points != null
                      ? String(data.last_gw_points)
                      : "—"
                  }
                />
                <Metric
                  label={t("seasonPerfTransfers")}
                  value={
                    data.free_transfers != null
                      ? String(data.free_transfers)
                      : "—"
                  }
                  hint={[
                    formatMoney(data.bank)
                      ? t("seasonPerfBank", { bank: formatMoney(data.bank)! })
                      : null,
                    formatMoney(data.team_value)
                      ? t("seasonPerfTv", {
                          tv: formatMoney(data.team_value)!,
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined}
                />
              </div>
              {data.rank_history && data.rank_history.length > 0 ? (
                <HomeRankSparkline
                  points={data.rank_history}
                  labels={{
                    you: t("seasonPerfChartYou"),
                    avg: t("seasonPerfChartAvg"),
                    aria: t("seasonPerfChartAria"),
                    hint: t("seasonPerfChartHint"),
                  }}
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/manager/${entryId}`}
                  className="text-xs font-medium text-brand-accent hover:underline"
                >
                  {t("seasonPerfOpenManager")}
                </Link>
                <span className="text-xs text-muted-foreground">·</span>
                <Link
                  href={`/dashboard/${entryId}`}
                  className="text-xs font-medium text-brand-accent hover:underline"
                >
                  {t("fplSnapshotOpenDashboard")}
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("fplSnapshotEmpty")}</p>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

function SquadHealthBlock({
  entryId,
  data,
  loading,
  error,
}: {
  entryId: string | null;
  data: TeamSummary | null;
  loading: boolean;
  error: string | null;
}) {
  const t = useTranslations("home");
  const health = data?.health;
  const names = data ? starterNames(data) : [];
  const captain = data?.squad?.captain;

  const statusLabel =
    health?.status === "alert"
      ? t("seasonHealthAlert")
      : health?.status === "watch"
        ? t("seasonHealthWatch")
        : t("seasonHealthGood");

  const statusClass =
    health?.status === "alert"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : health?.status === "watch"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";

  const kindLabel = (kind: HealthFlag["kind"]) => {
    switch (kind) {
      case "injured":
        return t("seasonHealthKindInjured");
      case "doubtful":
        return t("seasonHealthKindDoubtful");
      case "suspended":
        return t("seasonHealthKindSuspended");
      case "unavailable":
        return t("seasonHealthKindUnavailable");
      default:
        return t("seasonHealthKindNews");
    }
  };

  return (
    <SectionShell
      eyebrow={t("seasonSquadEyebrow")}
      title={t("seasonSquadTitle")}
      description={t("seasonSquadDescription")}
      action={
        entryId ? (
          <Link
            href={`/dashboard/${entryId}`}
            className="text-xs font-medium text-brand-accent hover:underline"
          >
            {t("seasonSquadOpenDashboard")}
          </Link>
        ) : null
      }
    >
      <div className="rounded-xl border border-border bg-card/50 p-4">
        {!entryId ? (
          <p className="text-sm text-muted-foreground">{t("seasonSquadBind")}</p>
        ) : loading ? (
          <div className="space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-16 animate-pulse rounded-lg bg-muted/50" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold",
                  statusClass,
                )}
              >
                {statusLabel}
              </span>
              {health ? (
                <span className="text-xs text-muted-foreground">
                  {t("seasonHealthStarters", {
                    ok: String(health.available_starters),
                    total: String(health.starter_count || 11),
                  })}
                </span>
              ) : null}
            </div>

            {names.length > 0 ? (
              <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5">
                {captain ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t("fplSnapshotCaptain", { name: captain })}
                  </p>
                ) : null}
                <p className="mt-1 text-xs leading-relaxed text-foreground/85">
                  {t("fplSnapshotSquad", { names: names.join(" · ") })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("seasonSquadEmpty")}</p>
            )}

            {health?.flags?.length ? (
              <ul className="flex flex-col gap-1.5">
                {health.flags.map((flag) => (
                  <li
                    key={`${flag.fpl_id}-${flag.kind}`}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium text-foreground">
                      {flag.web_name}
                    </span>
                    <span className="text-muted-foreground">
                      {kindLabel(flag.kind)}
                    </span>
                    {flag.note ? (
                      <span className="text-muted-foreground/90">· {flag.note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : health?.status === "good" ? (
              <p className="text-xs text-muted-foreground">{t("seasonHealthNone")}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Link
                href={entryId ? `/planner/${entryId}` : "/planner"}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground no-underline hover:border-brand-accent/50 hover:text-brand-accent"
              >
                {t("fplOpenPlanner")}
              </Link>
              <Link
                href="/squad-builder"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground no-underline hover:border-brand-accent/50 hover:text-brand-accent"
              >
                {t("fplOpenSquadBuilder")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </SectionShell>
  );
}

type ScoutTeaserItem = {
  id: string;
  slug: string;
  title_en: string;
  title_zh: string;
  hero_image_url: string | null;
  source_published_at: string | null;
};

function FfscoutArticlesSection() {
  const t = useTranslations("home");
  const locale = useLocale();
  const [items, setItems] = useState<ScoutTeaserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scout")
      .then(async (res) => {
        const json = (await res.json()) as {
          items?: ScoutTeaserItem[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "failed");
        if (!cancelled) setItems((json.items ?? []).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const titleOf = (item: ScoutTeaserItem) =>
    locale.startsWith("zh") && item.title_zh?.trim()
      ? item.title_zh
      : item.title_en;

  return (
    <SectionShell
      eyebrow={t("seasonScoutEyebrow")}
      title={t("seasonScoutTitle")}
      titleHref="/scout"
      description={t("seasonScoutDescription")}
      action={
        <Link
          href="/scout"
          className="text-xs font-medium text-brand-accent hover:underline"
        >
          {t("seasonScoutSeeAll")}
        </Link>
      }
    >
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("seasonScoutEmpty")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/scout/${item.slug}`}
              className="group overflow-hidden rounded-xl border border-border bg-card/40 no-underline transition-colors hover:border-brand-accent/40"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {item.hero_image_url ? (
                  <img
                    src={item.hero_image_url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    FFScout
                  </div>
                )}
              </div>
              <div className="px-3 py-2.5">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-brand-accent">
                  {titleOf(item)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

export function HomeSeasonHubLayout({
  sidebar,
  footer,
}: {
  sidebar: ReactNode;
  footer?: ReactNode;
}) {
  const t = useTranslations("home");
  const { entryId } = useEntryId();
  const { data, loading, error } = useTeamSummary();

  const manageTop = [
    {
      href: entryId ? `/dashboard/${entryId}` : "/dashboard",
      label: t("fplOpenDashboard"),
      body: t("seasonToolDashboardBody"),
    },
  ];

  const manageBottom = [
    {
      href: entryId ? `/manager/${entryId}` : "/manager",
      label: t("homeGroupManager"),
      body: t("seasonToolManagerBody"),
    },
  ];

  const decideTools = [
    {
      href: "/fpl/mini-league",
      label: t("seasonToolMiniLeague"),
      body: t("seasonToolMiniLeagueBody"),
    },
  ];

  const learnTools = [
    {
      href: "/fpl/guide",
      label: t("exploreGuideTitle"),
      body: t("exploreGuideBody"),
    },
    {
      href: "/news",
      label: t("sidebarNews"),
      body: t("seasonToolNewsBody"),
    },
    {
      href: "/scout",
      label: t("seasonToolFfscout"),
      body: t("seasonToolFfscoutBody"),
    },
  ];

  const statsItems = [
    {
      href: "/fpl/fixtures",
      label: t("exploreFixturesTitle"),
      body: t("seasonStatFixturesBody"),
    },
    {
      href: "/fpl/insights/differentials",
      label: t("seasonStatDifferentials"),
      body: t("seasonStatDifferentialsBody"),
    },
    {
      href: "/players",
      label: t("explorePlayersTitle"),
      body: t("explorePlayersBody"),
    },
    {
      href: "/fpl/historical",
      label: t("exploreHistoricalTitle"),
      body: t("exploreHistoricalBody"),
    },
    {
      href: "/fpl/insights/transfers",
      label: t("seasonStatTransfers"),
      body: t("seasonStatTransfersBody"),
    },
    {
      href: "/fpl/insights/best-of-position",
      label: t("seasonStatBop"),
      body: t("seasonStatBopBody"),
    },
    {
      href: "/fpl/insights/set-pieces",
      label: t("seasonStatSetPieces"),
      body: t("seasonStatSetPiecesBody"),
    },
    {
      href: "/fpl/insights/price-changes",
      label: t("seasonStatPrice"),
      body: t("seasonStatPriceBody"),
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(20rem,24rem)] xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="order-1 flex flex-col gap-8 lg:col-start-1 lg:row-start-1">
        <PerformanceBlock
          entryId={entryId}
          data={data}
          loading={loading}
          error={error}
        />
      </div>

      <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:self-start">
        {sidebar}
      </div>

      <div className="order-3 flex flex-col gap-8 lg:col-start-1 lg:row-start-2">
        <FfscoutArticlesSection />
      </div>

      <div className="order-4 flex flex-col gap-8 lg:col-start-1 lg:row-start-3">
        <SquadHealthBlock
          entryId={entryId}
          data={data}
          loading={loading}
          error={error}
        />

        <SectionShell
          eyebrow={t("seasonToolsEyebrow")}
          title={t("seasonToolsTitle")}
          description={t("seasonToolsDescription")}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ToolGroup
              title={t("seasonToolsManage")}
              items={manageTop}
              footer={
                <>
                  <PlanBuildCard
                    title={t("seasonToolPlanBuild")}
                    body={t("seasonToolPlanBuildBody")}
                    plannerHref={entryId ? `/planner/${entryId}` : "/planner"}
                    plannerLabel={t("fplOpenPlanner")}
                    builderHref="/squad-builder"
                    builderLabel={t("fplOpenSquadBuilder")}
                  />
                  {manageBottom.map((item) => (
                    <div
                      key={item.href}
                      className="border-t border-border/50 last:border-0"
                    >
                      <Link
                        href={item.href}
                        className="group flex items-start justify-between gap-3 px-3.5 py-2.5 no-underline transition-colors hover:bg-muted/40"
                      >
                        <span>
                          <span className="block text-sm font-medium text-foreground group-hover:text-brand-accent">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {item.body}
                          </span>
                        </span>
                        <span className="shrink-0 pt-0.5 text-muted-foreground group-hover:text-brand-accent">
                          →
                        </span>
                      </Link>
                    </div>
                  ))}
                </>
              }
            />
            <ToolGroup title={t("seasonToolsDecide")} items={decideTools} />
            <ToolGroup title={t("seasonToolsLearn")} items={learnTools} />
          </div>
        </SectionShell>

        <SectionShell
          eyebrow={t("seasonStatsEyebrow")}
          title={t("seasonStatsTitle")}
          titleHref="/fpl/insights"
          description={t("seasonStatsDescription")}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {statsItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-xl border border-border bg-card/40 px-3.5 py-3 no-underline transition-colors hover:border-brand-accent/40 hover:bg-muted/30"
              >
                <p className="text-sm font-medium text-foreground group-hover:text-brand-accent">
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p>
              </Link>
            ))}
          </div>
        </SectionShell>

        {footer}
      </div>
    </div>
  );
}
