"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GatedLink } from "@/components/auth/gated-link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { HomeGuestLanding } from "@/components/home/home-guest-landing";
import { DeadlineCountdown } from "@/components/home/deadline-countdown";
import { HomeSeasonHubLayout } from "@/components/home/home-season-hub";
import { MatchdayTicker } from "@/components/home/matchday-ticker";
import { WhatsNewSidebar } from "@/components/home/whats-new-sidebar";
import type { HomeHubData, HomeMatchSnippet, TodayTickerItem } from "@/lib/home/hub-data";
import { proxiedNewsImageUrl } from "@/lib/news-image";
import type { WcNewsItem } from "@/lib/wc/news-feeds";
import type { GroupTable, LeaderboardRow } from "@/lib/wc/standings";
import { WcFlag } from "@/components/worldcup/wc-flag";
import { NewsThumb } from "@/components/news/news-thumb";
import { DigestSummaryBody } from "@/components/news/fpl-digest-day-block";
import {
  InboxNotificationRow,
  type InboxNotification,
} from "@/components/inbox/inbox-notification-row";
import { groupNotificationsByCategory } from "@/lib/notifications/categories";

function HubSection({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-brand-accent">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
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

function HubChip({
  href,
  children,
  variant = "default",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "accent";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors no-underline",
        variant === "accent"
          ? "border-brand-accent/35 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/15"
          : "border-border bg-card text-foreground/90 hover:border-border hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

function fmtDeadline(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtKickoff(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function TodayTicker({
  items,
  fpl,
  locale,
  labels,
}: {
  items: TodayTickerItem[];
  fpl: HomeHubData["today"]["fpl"];
  locale: string;
  labels: {
    result: string;
    upcoming: string;
    fplDeadline: string;
    fplGw: string;
    noItems: string;
  };
}) {
  const chips: React.ReactNode[] = [];

  for (const item of items) {
    const m = item.match;
    const finished =
      item.kind === "result" &&
      m.home_score != null &&
      m.away_score != null;

    chips.push(
      <Link
        key={`${item.kind}-${m.id}`}
        href="/worldcup?tab=matches"
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground/90 no-underline hover:border-brand-accent/30 hover:text-foreground"
      >
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            item.kind === "result" ? "text-brand-accent" : "text-sky-400",
          )}
        >
          {item.kind === "result" ? labels.result : labels.upcoming}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <WcFlag code={m.home_code} size={16} title={m.home_name} />
          <span className="max-w-[5rem] truncate sm:max-w-none">{m.home_name}</span>
        </span>
        <span className="tabular-nums text-foreground">
          {finished ? `${m.home_score}–${m.away_score}` : "vs"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="max-w-[5rem] truncate sm:max-w-none">{m.away_name}</span>
          <WcFlag code={m.away_code} size={16} title={m.away_name} />
        </span>
        {!finished && m.kickoff ? (
          <span className="text-xs text-muted-foreground">
            {fmtKickoff(m.kickoff, locale)}
          </span>
        ) : null}
        <span className="text-[10px] text-muted-foreground/80">{m.round_label}</span>
      </Link>,
    );
  }

  if (fpl.gw != null) {
    chips.push(
      <Link
        key="fpl"
        href="/planner"
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-brand-accent/25 bg-brand-accent/10 px-3 py-1.5 text-sm text-foreground/90 no-underline hover:border-brand-accent/40"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-accent">
          {labels.fplDeadline}
        </span>
        <span>
          {labels.fplGw}
          {fpl.deadline ? ` · ${fmtDeadline(fpl.deadline, locale)}` : ""}
        </span>
      </Link>,
    );
  }

  if (chips.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
        {labels.noItems}
      </div>
    );
  }

  const loop = [...chips, ...chips];

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card/50 py-2.5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
      <div className="overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-3 px-4 animate-[marquee_50s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none">
          {loop.map((chip, i) => (
            <div key={i} className="shrink-0">
              {chip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type InboxItem = InboxNotification;

function YourFootballSection({
  labels,
}: {
  labels: {
    title: string;
    guestTitle: string;
    guestBody: string;
    signUp: string;
    signIn: string;
    inboxCta: string;
    empty: string;
    loading: string;
    sectionNews: string;
    sectionMessages: string;
    emptyNews: string;
    emptyMessages: string;
  };
}) {
  const { user, profile, unreadCount, loading: authLoading } = useAuth();
  const tHome = useTranslations("home");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=8");
      if (!res.ok) return;
      const data = (await res.json()) as { items?: InboxItem[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authLoading) {
    return (
      <div className="h-28 animate-pulse rounded-xl border border-border bg-card" />
    );
  }

  if (!user) {
    return (
      <section className="home-hub-card overflow-hidden rounded-xl border border-border bg-card/40">
        <div className="border-b border-border/80 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{labels.guestTitle}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {labels.guestBody}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 px-4 py-3">
          <Link href="/auth/signup" className={cn(buttonVariants(), "no-underline")}>
            {labels.signUp}
          </Link>
          <Link
            href="/auth/login"
            className={cn(buttonVariants({ variant: "secondary" }), "no-underline")}
          >
            {labels.signIn}
          </Link>
        </div>
      </section>
    );
  }

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "";
  const { news, message } = groupNotificationsByCategory(items);
  const previewNews = news.slice(0, 2);
  const previewMessages = message.slice(0, 2);

  return (
    <section className="home-hub-card overflow-hidden rounded-xl border border-sky-500/25 bg-gradient-to-b from-sky-500/[0.07] to-card/40">
      <div className="flex items-start justify-between gap-3 border-b border-sky-500/15 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
          {name ? (
            <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {name}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {unreadCount > 0 ? (
            <span className="rounded-full bg-brand-accent/15 px-2 py-0.5 text-[11px] font-medium text-brand-accent">
              {tHome("yourFootballUnread", { n: unreadCount })}
            </span>
          ) : null}
          <Link
            href="/inbox"
            className="text-xs font-medium text-brand-accent no-underline hover:underline"
          >
            {labels.inboxCta}
          </Link>
        </div>
      </div>

      <div className="px-4 py-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">{labels.loading}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {labels.sectionNews}
              </h3>
              {previewNews.length === 0 ? (
                <p className="text-xs text-muted-foreground">{labels.emptyNews}</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {previewNews.map((n) => (
                    <li key={n.id}>
                      <InboxNotificationRow item={n} compact />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {labels.sectionMessages}
              </h3>
              {previewMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground">{labels.emptyMessages}</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {previewMessages.map((n) => (
                    <li key={n.id}>
                      <InboxNotificationRow item={n} compact />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function WcMatchCard({
  match,
  locale,
}: {
  match: HomeMatchSnippet;
  locale: string;
}) {
  const finished =
    match.home_score != null &&
    match.away_score != null &&
    (match.status.toLowerCase() === "finished" ||
      match.status.toLowerCase() === "complete");

  return (
    <Link
      href="/worldcup?tab=matches"
      className="flex flex-col gap-2 rounded-xl border border-border bg-card/50 p-4 no-underline transition-colors hover:border-brand-accent/25 hover:bg-card"
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {match.round_label} · {fmtKickoff(match.kickoff, locale)}
      </span>
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
        <span className="truncate inline-flex items-center gap-1.5">
          <WcFlag code={match.home_code} size={16} title={match.home_name} />
          {match.home_name}
        </span>
        <span className="shrink-0 tabular-nums text-brand-accent">
          {finished
            ? `${match.home_score}–${match.away_score}`
            : "vs"}
        </span>
        <span className="truncate text-right inline-flex items-center justify-end gap-1.5">
          {match.away_name}
          <WcFlag code={match.away_code} size={16} title={match.away_name} />
        </span>
      </div>
    </Link>
  );
}

function HomeMatchRow({
  item,
  locale,
  labels,
}: {
  item: TodayTickerItem;
  locale: string;
  labels: { result: string; upcoming: string };
}) {
  const m = item.match;
  const finished =
    item.kind === "result" &&
    m.home_score != null &&
    m.away_score != null;

  return (
    <Link
      href="/worldcup?tab=matches"
      className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 text-sm no-underline transition-colors last:border-b-0 hover:bg-muted/40"
    >
      <span
        className={cn(
          "w-10 shrink-0 text-center text-[10px] font-semibold uppercase tracking-wide",
          item.kind === "result" ? "text-muted-foreground" : "text-sky-400",
        )}
      >
        {finished ? labels.result : m.kickoff ? fmtKickoff(m.kickoff, locale) : labels.upcoming}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <span className="truncate">{m.home_name}</span>
          <WcFlag code={m.home_code} size={18} title={m.home_name} />
        </span>
        <span className="shrink-0 tabular-nums font-semibold text-brand-accent">
          {finished ? `${m.home_score} - ${m.away_score}` : "vs"}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <WcFlag code={m.away_code} size={18} title={m.away_name} />
          <span className="truncate">{m.away_name}</span>
        </span>
      </div>
    </Link>
  );
}

function HomeNewsSidebarItem({ item }: { item: WcNewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 py-2.5 no-underline transition-colors hover:opacity-90"
    >
      <NewsThumb imageUrl={item.image_url} outlet={item.outlet} size={64} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {item.title}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">{item.outlet}</p>
      </div>
    </a>
  );
}

function HomeNewsSidebar({
  news,
  transfers,
  fplTweets,
  fplDailyDigest,
  labels,
}: {
  news: WcNewsItem[];
  transfers: WcNewsItem[];
  fplTweets: WcNewsItem[];
  fplDailyDigest: {
    digest_date: string;
    summary: string;
    source_count: number;
  } | null;
  labels: {
    newsTitle: string;
    transfersTitle: string;
    fplXTitle: string;
    fplDailyTitle: string;
    seeAll: string;
    seeTransfers: string;
    seeFplX: string;
    seeFplDaily: string;
    empty: string;
  };
}) {
  const { user } = useAuth();
  const tSignup = useTranslations("signupPrompt");
  const tHome = useTranslations("home");

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-[4.5rem] lg:self-start">
      {fplDailyDigest ? (
        <section className="home-hub-card overflow-hidden rounded-xl border border-brand-accent/25 bg-gradient-to-b from-brand-accent/[0.07] to-card/40">
          <div className="flex items-center justify-between gap-3 border-b border-brand-accent/15 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">
                {labels.fplDailyTitle}
              </h2>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {fplDailyDigest.digest_date}
              </p>
            </div>
            <GatedLink
              href="/news/fpl-daily"
              className="shrink-0 text-xs font-medium text-brand-accent no-underline hover:underline"
            >
              {labels.seeFplDaily}
            </GatedLink>
          </div>
          {user ? (
            <GatedLink
              href="/news/fpl-daily"
              className="block px-4 py-3 no-underline transition-opacity hover:opacity-95"
            >
              <DigestSummaryBody
                summary={fplDailyDigest.summary}
                maxSections={3}
                maxBullets={5}
                compact
              />
              <p className="mt-3 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
                {tHome("sidebarFplDailySources", {
                  n: fplDailyDigest.source_count,
                })}
              </p>
            </GatedLink>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {tSignup("fplNewsSignInHint")}
            </p>
          )}
        </section>
      ) : null}

      <section className="home-hub-card rounded-xl border">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h2 className="text-sm font-semibold text-foreground">{labels.newsTitle}</h2>
          <Link
            href="/news"
            className="text-xs font-medium text-brand-accent no-underline hover:underline"
          >
            {labels.seeAll}
          </Link>
        </div>
        <div className="space-y-1 px-4 pb-3">
          {news.length > 0 ? (
            news.map((item) => <HomeNewsSidebarItem key={item.id} item={item} />)
          ) : (
            <p className="py-4 text-sm text-muted-foreground">{labels.empty}</p>
          )}
        </div>
      </section>

      {fplTweets.length > 0 ? (
        <section className="home-hub-card rounded-xl border">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <h2 className="text-sm font-semibold text-foreground">{labels.fplXTitle}</h2>
            <GatedLink
              href="/news/fpl-x"
              className="text-xs font-medium text-brand-accent no-underline hover:underline"
            >
              {labels.seeFplX}
            </GatedLink>
          </div>
          {user ? (
            <div className="space-y-1 px-4 pb-3">
              {fplTweets.map((item) => (
                <HomeNewsSidebarItem key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="px-4 pb-3 text-sm text-muted-foreground">
              {tSignup("fplNewsSignInHint")}
            </p>
          )}
        </section>
      ) : null}

      {transfers.length > 0 ? (
        <section className="home-hub-card rounded-xl border">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <h2 className="text-sm font-semibold text-foreground">{labels.transfersTitle}</h2>
            <Link
              href="/news?category=transfer"
              className="text-xs font-medium text-brand-accent no-underline hover:underline"
            >
              {labels.seeTransfers}
            </Link>
          </div>
          <div className="space-y-1 px-4 pb-3">
            {transfers.map((item) => (
              <HomeNewsSidebarItem key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function HomeLeaderboardMini({
  title,
  rows,
  stat,
}: {
  title: string;
  rows: LeaderboardRow[];
  stat: "goals" | "assists";
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ol className="space-y-1.5 text-sm">
        {rows.slice(0, 5).map((s, i) => (
          <li key={s.player_id} className="flex justify-between gap-2 text-foreground/80">
            <span className="min-w-0 truncate">
              <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}</span>
              {s.name}
            </span>
            <span className="shrink-0 tabular-nums font-medium text-foreground">
              {stat === "goals" ? s.goals : s.assists}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function HomeWcMain({
  wc,
  ticker,
  locale,
  labels,
}: {
  wc: HomeHubData["wc"];
  ticker: TodayTickerItem[];
  locale: string;
  labels: {
    title: string;
    allMatches: string;
    allTables: string;
    group: string;
    scorers: string;
    assists: string;
    empty: string;
    result: string;
    upcoming: string;
    tableCols: {
      group: string;
      team: string;
      p: string;
      w: string;
      d: string;
      l: string;
      gf: string;
      ga: string;
      gd: string;
      pts: string;
    };
  };
}) {
  const hasContent =
    ticker.length > 0 ||
    wc.groupsPreview.length > 0 ||
    wc.nextMatches.length > 0 ||
    wc.topScorers.length > 0 ||
    wc.topAssists.length > 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-gradient-to-r from-sky-950/40 to-transparent px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
        <div className="flex gap-2">
          <HubChip href="/worldcup?tab=matches">{labels.allMatches}</HubChip>
          <HubChip href="/worldcup?tab=tables">{labels.allTables}</HubChip>
        </div>
      </div>

      {!hasContent ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {ticker.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border bg-background/40">
              {ticker.slice(0, 10).map((item) => (
                <HomeMatchRow
                  key={`${item.kind}-${item.match.id}`}
                  item={item}
                  locale={locale}
                  labels={{ result: labels.result, upcoming: labels.upcoming }}
                />
              ))}
            </div>
          ) : null}

          {wc.groupsPreview.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {wc.groupsPreview.map((g) => (
                <MiniGroupTable
                  key={g.group_letter}
                  group={g}
                  labels={labels.tableCols}
                />
              ))}
            </div>
          ) : null}

          {wc.topScorers.length > 0 || wc.topAssists.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {wc.topScorers.length > 0 ? (
                <HomeLeaderboardMini
                  title={labels.scorers}
                  rows={wc.topScorers}
                  stat="goals"
                />
              ) : null}
              {wc.topAssists.length > 0 ? (
                <HomeLeaderboardMini
                  title={labels.assists}
                  rows={wc.topAssists}
                  stat="assists"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function MiniGroupTable({
  group,
  labels,
}: {
  group: GroupTable;
  labels: {
    group: string;
    team: string;
    p: string;
    w: string;
    d: string;
    l: string;
    gf: string;
    ga: string;
    gd: string;
    pts: string;
  };
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50">
      <div className="border-b border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground sm:text-sm">
        {labels.group} {group.group_letter}
      </div>
      <div className="scroll-table">
        <table className="w-full min-w-[17rem] text-left text-[11px] sm:text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="px-2 py-1.5 font-medium">#</th>
              <th className="px-2 py-1.5 font-medium">{labels.team}</th>
              <th className="px-1 py-1.5 text-center font-medium">{labels.p}</th>
              <th className="px-1 py-1.5 text-center font-medium">{labels.w}</th>
              <th className="px-1 py-1.5 text-center font-medium">{labels.d}</th>
              <th className="px-1 py-1.5 text-center font-medium">{labels.l}</th>
              <th className="hidden px-1 py-1.5 text-center font-medium sm:table-cell">
                {labels.gf}
              </th>
              <th className="hidden px-1 py-1.5 text-center font-medium sm:table-cell">
                {labels.ga}
              </th>
              <th className="px-1 py-1.5 text-center font-medium">{labels.gd}</th>
              <th className="px-2 py-1.5 text-center font-medium">{labels.pts}</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <tr key={row.code} className="border-t border-border/50">
                <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{row.rank}</td>
                <td className="max-w-[6rem] px-1 py-1.5 font-medium text-foreground sm:max-w-none">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <WcFlag code={row.code} size={18} title={row.name} />
                    <span className="truncate">{row.name}</span>
                  </span>
                </td>
                <td className="px-1 py-1.5 text-center tabular-nums">{row.played}</td>
                <td className="px-1 py-1.5 text-center tabular-nums">{row.won}</td>
                <td className="px-1 py-1.5 text-center tabular-nums">{row.drawn}</td>
                <td className="px-1 py-1.5 text-center tabular-nums">{row.lost}</td>
                <td className="hidden px-1 py-1.5 text-center tabular-nums sm:table-cell">
                  {row.gf}
                </td>
                <td className="hidden px-1 py-1.5 text-center tabular-nums sm:table-cell">
                  {row.ga}
                </td>
                <td className="px-1 py-1.5 text-center tabular-nums">{row.gd}</td>
                <td className="px-2 py-1.5 text-center font-semibold tabular-nums text-brand-accent">
                  {row.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorldCupSection({
  wc,
  locale,
  labels,
}: {
  wc: HomeHubData["wc"];
  locale: string;
  labels: {
    eyebrow: string;
    title: string;
    description: string;
    allMatches: string;
    allTables: string;
    scorers: string;
    assists: string;
    group: string;
    team: string;
    pts: string;
    empty: string;
  };
}) {
  return (
    <HubSection
      eyebrow={labels.eyebrow}
      title={labels.title}
      description={labels.description}
      action={
        <div className="flex flex-wrap gap-2">
          <HubChip href="/worldcup?tab=matches">{labels.allMatches}</HubChip>
          <HubChip href="/worldcup?tab=tables">{labels.allTables}</HubChip>
        </div>
      }
    >
      {wc.nextMatches.length === 0 &&
      wc.groupsPreview.length === 0 &&
      wc.topScorers.length === 0 &&
      wc.topAssists.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {wc.nextMatches.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {wc.nextMatches.map((m) => (
                <WcMatchCard key={m.id} match={m} locale={locale} />
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(12rem,16rem)]">
            {wc.groupsPreview.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {wc.groupsPreview.map((g) => (
                  <MiniGroupTable
                    key={g.group_letter}
                    group={g}
                    labels={{
                      group: labels.group,
                      team: labels.team,
                      p: "P",
                      w: "W",
                      d: "D",
                      l: "L",
                      gf: "GF",
                      ga: "GA",
                      gd: "GD",
                      pts: labels.pts,
                    }}
                  />
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              {wc.topScorers.length > 0 ? (
                <div className="rounded-xl border border-border bg-card/50 p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {labels.scorers}
                  </h3>
                  <ol className="space-y-1.5 text-sm">
                    {wc.topScorers.map((s: LeaderboardRow, i) => (
                      <li
                        key={s.player_id}
                        className="flex justify-between gap-2 text-foreground/70"
                      >
                        <span>
                          <span className="mr-2 tabular-nums text-muted-foreground/80">
                            {i + 1}
                          </span>
                          {s.name}
                        </span>
                        <span className="tabular-nums text-foreground">{s.goals}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {wc.topAssists.length > 0 ? (
                <div className="rounded-xl border border-border bg-card/50 p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {labels.assists}
                  </h3>
                  <ol className="space-y-1.5 text-sm">
                    {wc.topAssists.map((s: LeaderboardRow, i) => (
                      <li
                        key={`a-${s.player_id}`}
                        className="flex justify-between gap-2 text-foreground/70"
                      >
                        <span>
                          <span className="mr-2 tabular-nums text-muted-foreground/80">
                            {i + 1}
                          </span>
                          {s.name}
                        </span>
                        <span className="tabular-nums text-foreground">{s.assists}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </HubSection>
  );
}

function HomeNewsCard({
  item,
  readMore,
}: {
  item: WcNewsItem;
  readMore: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(proxiedNewsImageUrl(item.image_url)) && !imgFailed;
  const imgSrc = proxiedNewsImageUrl(item.image_url);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card/50 transition-colors hover:border-border">
      <div className={cn("flex flex-col", showImage && "sm:flex-row")}>
        {showImage ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block shrink-0 sm:w-32"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc!}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="h-28 w-full object-cover sm:h-full sm:min-h-[5.5rem]"
            />
          </a>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col p-3">
          <span className="text-[10px] font-medium uppercase text-muted-foreground">
            {item.outlet}
          </span>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-accent"
            >
              {item.title}
            </a>
          </h3>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto pt-2 text-xs text-brand-accent hover:underline"
          >
            {readMore} →
          </a>
        </div>
      </div>
    </article>
  );
}

function NewsSection({
  items,
  labels,
}: {
  items: WcNewsItem[];
  labels: {
    eyebrow: string;
    title: string;
    description: string;
    allNews: string;
    readMore: string;
    empty: string;
  };
}) {
  return (
    <HubSection
      eyebrow={labels.eyebrow}
      title={labels.title}
      description={labels.description}
      action={<HubChip href="/news">{labels.allNews}</HubChip>}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <HomeNewsCard
              key={item.id}
              item={item}
              readMore={labels.readMore}
            />
          ))}
        </div>
      )}
    </HubSection>
  );
}

export function HomeHub({ initialData }: { initialData?: HomeHubData | null }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<HomeHubData | null>(initialData ?? null);
  const [hubError, setHubError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHub(attempt = 0): Promise<void> {
      if (attempt === 0) {
        setHubError(null);
      }
      try {
        const res = await fetch(`/api/home/hub?locale=${encodeURIComponent(locale)}`);
        const json = (await res.json()) as HomeHubData & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load");
        if (!cancelled) {
          setData(json);
          setHubError(null);
        }
      } catch (e) {
        if (cancelled) return;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          return fetchHub(attempt + 1);
        }
        if (!cancelled) {
          setHubError(e instanceof Error ? e.message : "Failed to load");
        }
      }
    }

    void fetchHub();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when locale changes
  }, [locale]);

  const hub = data ?? {
    today: { ticker: [], fpl: { gw: null, deadline: null, open: false } },
    wc: {
      nextMatches: [],
      groupsPreview: [],
      topScorers: [],
      topAssists: [],
    },
    news: [],
    transferNews: [],
    eplNews: [],
    fplTweets: [],
    fplDailyDigest: null,
  };

  if (!authLoading && !user) {
    return <HomeGuestLanding news={hub.eplNews.length > 0 ? hub.eplNews : hub.news} />;
  }

  if (authLoading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="h-14 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 md:gap-6">
      <MatchdayTicker />

      {hub.today.fpl.gw != null ? (
        <Link
          href="/planner"
          className="home-hub-deadline flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 no-underline"
        >
          <span className="home-hub-deadline-label text-sm font-semibold">
            {t("todayFpl")} · {t("todayFplGw", { gw: String(hub.today.fpl.gw) })}
          </span>
          <span className="flex flex-col items-end gap-0.5 text-sm sm:flex-row sm:items-center sm:gap-3">
            {hub.today.fpl.deadline ? (
              <>
                <DeadlineCountdown
                  deadlineIso={hub.today.fpl.deadline}
                  className="text-base sm:text-lg"
                />
                <span className="text-xs text-muted-foreground sm:text-sm">
                  {fmtDeadline(hub.today.fpl.deadline, locale)}
                </span>
              </>
            ) : (
              <span className="text-foreground/90">{t("todayEmpty")}</span>
            )}
          </span>
        </Link>
      ) : null}

      <HomeSeasonHubLayout
        sidebar={<WhatsNewSidebar />}
        footer={
          hubError ? (
            <p className="text-xs text-muted-foreground">{hubError}</p>
          ) : null
        }
      />
    </div>
  );
}
