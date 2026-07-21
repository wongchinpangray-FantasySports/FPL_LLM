"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { EntryIdForm } from "@/components/entry-id-form";
import { useEntryId } from "@/components/entry-id-context";
import { useAuth } from "@/components/auth/auth-provider";
import { HomeGuestLanding } from "@/components/home/home-guest-landing";
import type { HomeHubData, HomeMatchSnippet, TodayTickerItem } from "@/lib/home/hub-data";
import { proxiedNewsImageUrl } from "@/lib/news-image";
import type { WcNewsItem } from "@/lib/wc/news-feeds";
import type { GroupTable, LeaderboardRow } from "@/lib/wc/standings";
import { WcFlag } from "@/components/worldcup/wc-flag";
import { NewsThumb } from "@/components/news/news-thumb";

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

type InboxItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

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
    unread: string;
  };
}) {
  const { user, profile, unreadCount, loading: authLoading } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=3");
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
      <HubSection title={labels.title}>
        <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />
      </HubSection>
    );
  }

  if (!user) {
    return (
      <HubSection title={labels.guestTitle} description={labels.guestBody}>
        <div className="flex flex-wrap gap-2">
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
      </HubSection>
    );
  }

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "";

  return (
    <section className="home-hub-card rounded-xl border">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
          {name ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{name}</p>
          ) : null}
        </div>
        {unreadCount > 0 ? (
          <span className="shrink-0 rounded-full bg-brand-accent/15 px-2 py-0.5 text-[11px] font-medium text-brand-accent">
            {labels.unread.replace("{n}", String(unreadCount))}
          </span>
        ) : null}
      </div>
      <div className="px-4 pb-3 pt-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">{labels.loading}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <ul className="space-y-1">
            {items.map((n) => (
              <li key={n.id}>
                {n.href ? (
                  <Link
                    href={n.href}
                    className="block py-2.5 no-underline hover:opacity-90"
                  >
                    <p
                      className={cn(
                        "text-sm leading-snug",
                        n.read_at ? "text-muted-foreground" : "font-medium text-foreground",
                      )}
                    >
                      {n.title}
                    </p>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {n.body}
                      </p>
                    ) : null}
                  </Link>
                ) : (
                  <div className="py-2.5">
                    <p className="text-sm text-foreground">{n.title}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/inbox"
          className="mt-2 inline-block text-xs font-medium text-brand-accent no-underline hover:underline"
        >
          {labels.inboxCta} →
        </Link>
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
  labels,
}: {
  news: WcNewsItem[];
  transfers: WcNewsItem[];
  labels: {
    newsTitle: string;
    transfersTitle: string;
    seeAll: string;
    seeTransfers: string;
    empty: string;
  };
}) {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-[4.5rem] lg:self-start">
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
    <div className="overflow-hidden rounded-xl border border-border bg-card/50">
      <div className="border-b border-border bg-card/80 px-3 py-2.5 text-xs font-semibold text-foreground sm:text-sm">
        {labels.group} {group.group_letter}
      </div>
      <div className="overflow-x-auto">
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

type SquadSnapshot = {
  entry?: {
    name?: string;
    player_first_name?: string;
    player_last_name?: string;
    summary_overall_rank?: number;
    summary_overall_points?: number;
    current_event?: number;
  };
  picks_gw?: number | null;
  current_gw?: number | null;
};

function squadDisplayName(s: SquadSnapshot): string | null {
  const e = s.entry;
  if (!e) return null;
  const teamName = e.name?.trim();
  if (teamName) return teamName;
  const parts = [e.player_first_name, e.player_last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function formatSnapshotRank(rank: number | undefined, locale: string): string | null {
  if (rank == null || rank <= 0) return null;
  return rank.toLocaleString(locale);
}

function formatSnapshotPoints(points: number | undefined): string | null {
  if (points == null || points < 0) return null;
  return String(points);
}

function snapshotPlanningGw(s: SquadSnapshot): number | null {
  const gw = s.picks_gw ?? s.current_gw ?? s.entry?.current_event ?? null;
  return gw != null && gw > 0 ? gw : null;
}

function FplSection({
  labels,
}: {
  labels: {
    title: string;
    description: string;
    entryHint: string;
    snapshotLoading: string;
    snapshotRank: string;
    snapshotPoints: string;
    snapshotGw: string;
    snapshotError: string;
    snapshotEmpty: string;
  };
}) {
  const { entryId } = useEntryId();
  const [snapshot, setSnapshot] = useState<SquadSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const locale = useLocale();

  useEffect(() => {
    if (!entryId) {
      setSnapshot(null);
      setSnapshotError(null);
      return;
    }
    let cancelled = false;
    setSnapshotLoading(true);
    setSnapshotError(null);
    fetch(`/api/team/${entryId}/summary`)
      .then(async (res) => {
        const data = (await res.json()) as SquadSnapshot & { error?: string };
        if (!res.ok) throw new Error(data.error ?? labels.snapshotError);
        if (!cancelled) {
          setSnapshot(data);
          setSnapshotError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSnapshot(null);
          setSnapshotError(err instanceof Error ? err.message : labels.snapshotError);
        }
      })
      .finally(() => {
        if (!cancelled) setSnapshotLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when entry id changes
  }, [entryId]);

  return (
    <section className="home-hub-card home-hub-card-hero rounded-xl border">
      <div aria-hidden className="home-hub-glow-primary" />
      <div aria-hidden className="home-hub-glow-secondary" />
      <div className="home-hub-card-inner px-4 pb-2 pt-3">
        <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{labels.description}</p>
      </div>
      <div className="home-hub-card-inner flex flex-col gap-4 px-4 pb-4 pt-1">
        <div>
          <EntryIdForm
            redirectTo={(id) => `/dashboard/${id}`}
            showQuickLinks={false}
          />
          <p className="mt-2 text-xs text-muted-foreground">{labels.entryHint}</p>
        </div>

        {entryId ? (
          snapshotLoading ? (
            <div className="rounded-lg border border-border bg-card/80 px-3 py-3">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-48 animate-pulse rounded bg-muted" />
              <p className="mt-2 text-xs text-muted-foreground">{labels.snapshotLoading}</p>
            </div>
          ) : snapshotError ? (
            <p className="text-xs text-destructive">{snapshotError}</p>
          ) : snapshot ? (
            (() => {
              const rank = formatSnapshotRank(snapshot.entry?.summary_overall_rank, locale);
              const points = formatSnapshotPoints(snapshot.entry?.summary_overall_points);
              const gw = snapshotPlanningGw(snapshot);
              const stats = [
                rank != null ? labels.snapshotRank.replace("{rank}", rank) : null,
                points != null ? labels.snapshotPoints.replace("{pts}", points) : null,
                gw != null ? labels.snapshotGw.replace("{gw}", String(gw)) : null,
              ].filter(Boolean);

              return (
                <div className="home-hub-snapshot rounded-lg px-3 py-3">
                  <p className="text-sm font-medium text-foreground">
                    {squadDisplayName(snapshot) ?? `#${entryId}`}
                  </p>
                  {stats.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">{stats.join(" · ")}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">{labels.snapshotEmpty}</p>
                  )}
                </div>
              );
            })()
          ) : null
        ) : null}
      </div>
    </section>
  );
}

type FeatureLink = { href: string; label: string };

function FeatureGroup({
  title,
  items,
  variant,
}: {
  title: string;
  items: FeatureLink[];
  variant: number;
}) {
  return (
    <section
      className="home-hub-feature-group rounded-xl border"
      data-variant={String(variant % 4)}
    >
      <h3 className="home-hub-feature-title px-4 pb-1.5 pt-2.5 text-xs font-semibold uppercase tracking-wide">
        {title}
      </h3>
      <ul className="pb-1">
        {items.map((item) => (
          <li key={`${item.href}-${item.label}`}>
            <Link
              href={item.href}
              className="home-hub-feature-link group flex items-center justify-between gap-3 px-4 py-2.5 text-sm no-underline transition-colors"
            >
              <span className="text-foreground group-hover:text-brand-accent">{item.label}</span>
              <span className="shrink-0 text-muted-foreground group-hover:text-brand-accent">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HomeFeatureGroups({
  labels,
}: {
  labels: {
    manage: string;
    research: string;
    tools: string;
    game: string;
    dashboard: string;
    planner: string;
    manager: string;
    players: string;
    fixtures: string;
    preseason: string;
    historical: string;
    chat: string;
    mini: string;
    news: string;
  };
}) {
  const { entryId } = useEntryId();

  const manage: FeatureLink[] = [
    { href: entryId ? `/dashboard/${entryId}` : "/dashboard", label: labels.dashboard },
    { href: entryId ? `/planner/${entryId}` : "/planner", label: labels.planner },
    { href: entryId ? `/manager/${entryId}` : "/manager", label: labels.manager },
  ];

  const research: FeatureLink[] = [
    { href: "/players", label: labels.players },
    { href: "/fpl/fixtures", label: labels.fixtures },
    { href: "/fpl/preseason", label: labels.preseason },
    { href: "/fpl/historical", label: labels.historical },
  ];

  const tools: FeatureLink[] = [
    { href: "/chat", label: labels.chat },
    { href: "/news", label: labels.news },
  ];

  const game: FeatureLink[] = [{ href: "/mini", label: labels.mini }];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <FeatureGroup title={labels.manage} items={manage} variant={0} />
      <FeatureGroup title={labels.research} items={research} variant={1} />
      <FeatureGroup title={labels.tools} items={tools} variant={2} />
      <FeatureGroup title={labels.game} items={game} variant={3} />
    </div>
  );
}

export function HomeHub({ initialData }: { initialData?: HomeHubData | null }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<HomeHubData | null>(initialData ?? null);
  const [hubError, setHubError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when locale or auth settles
  }, [locale, authLoading]);

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
      {hub.today.fpl.gw != null ? (
        <Link
          href="/planner"
          className="home-hub-deadline flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 no-underline"
        >
          <span className="home-hub-deadline-label text-sm font-semibold">
            {t("todayFpl")} · {t("todayFplGw", { gw: String(hub.today.fpl.gw) })}
          </span>
          <span className="text-sm text-foreground/90">
            {hub.today.fpl.deadline
              ? fmtDeadline(hub.today.fpl.deadline, locale)
              : t("todayEmpty")}
          </span>
        </Link>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(20rem,24rem)] xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex flex-col gap-5">
          <FplSection
            labels={{
              title: t("fplTitle"),
              description: t("fplDescription"),
              entryHint: t("entryHint"),
              snapshotLoading: t("fplSnapshotLoading"),
              snapshotRank: t("fplSnapshotRank"),
              snapshotPoints: t("fplSnapshotPoints"),
              snapshotGw: t("fplSnapshotGw"),
              snapshotError: t("fplSnapshotError"),
              snapshotEmpty: t("fplSnapshotEmpty"),
            }}
          />

          <HomeFeatureGroups
            labels={{
              manage: t("homeGroupManage"),
              research: t("homeGroupResearch"),
              tools: t("homeGroupTools"),
              game: t("homeGroupGame"),
              dashboard: t("fplOpenDashboard"),
              planner: t("fplOpenPlanner"),
              manager: t("homeGroupManager"),
              players: t("explorePlayersTitle"),
              fixtures: t("exploreFixturesTitle"),
              preseason: t("explorePreseasonTitle"),
              historical: t("exploreHistoricalTitle"),
              chat: t("exploreChatTitle"),
              mini: t("exploreMiniTitle"),
              news: t("sidebarNews"),
            }}
          />

          {hubError ? (
            <p className="text-xs text-muted-foreground">{hubError}</p>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[4.5rem] lg:self-start">
          <YourFootballSection
            labels={{
              title: t("yourFootballTitle"),
              guestTitle: t("yourFootballGuestTitle"),
              guestBody: t("yourFootballGuestBody"),
              signUp: t("yourFootballSignUp"),
              signIn: t("yourFootballSignIn"),
              inboxCta: t("yourFootballInbox"),
              empty: t("yourFootballEmpty"),
              loading: t("loading"),
              unread: t("yourFootballUnread"),
            }}
          />
          <HomeNewsSidebar
            news={hub.eplNews.length > 0 ? hub.eplNews : hub.news}
            transfers={hub.transferNews}
            labels={{
              newsTitle: t("sidebarNews"),
              transfersTitle: t("sidebarTransfers"),
              seeAll: t("newsAll"),
              seeTransfers: t("ctaTransfers"),
              empty: t("newsEmpty"),
            }}
          />
        </aside>
      </div>
    </div>
  );
}
