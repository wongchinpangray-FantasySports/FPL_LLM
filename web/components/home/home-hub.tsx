"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { EntryIdForm } from "@/components/entry-id-form";
import { useEntryId } from "@/components/entry-id-context";
import { useAuth } from "@/components/auth/auth-provider";
import type { HomeHubData, HomeMatchSnippet, TodayTickerItem } from "@/lib/home/hub-data";
import { proxiedNewsImageUrl } from "@/lib/news-image";
import type { WcNewsItem } from "@/lib/wc/news-feeds";
import type { GroupTable, LeaderboardRow } from "@/lib/wc/standings";
import { wcTeamFlag } from "@/lib/wc/wc-team-flags";

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
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-brand-accent/90">
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
        <span>
          {wcTeamFlag(m.home_code)} {m.home_name}
        </span>
        <span className="tabular-nums text-foreground">
          {finished ? `${m.home_score}–${m.away_score}` : "vs"}
        </span>
        <span>
          {m.away_name} {wcTeamFlag(m.away_code)}
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
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-sm text-foreground/90 no-underline hover:border-emerald-400/40"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
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
      <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:overflow-hidden [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-3 px-4 md:animate-[marquee_50s_linear_infinite] md:hover:[animation-play-state:paused] motion-reduce:md:animate-none">
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
    <HubSection
      title={labels.title}
      description={name ? `${name}` : undefined}
      action={
        unreadCount > 0 ? (
          <span className="rounded-full bg-brand-accent/15 px-2.5 py-1 text-xs font-medium text-brand-accent">
            {labels.unread.replace("{n}", String(unreadCount))}
          </span>
        ) : null
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">{labels.loading}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="divide-y divide-white/[0.06] rounded-xl border border-border bg-card/50">
          {items.map((n) => (
            <li key={n.id}>
              {n.href ? (
                <Link
                  href={n.href}
                  className="block px-4 py-3 no-underline hover:bg-card"
                >
                  <p
                    className={cn(
                      "text-sm",
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
                <div className="px-4 py-3">
                  <p className="text-sm text-foreground">{n.title}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/inbox"
        className="text-sm font-medium text-brand-accent no-underline hover:underline"
      >
        {labels.inboxCta} →
      </Link>
    </HubSection>
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
        <span className="truncate">
          {wcTeamFlag(match.home_code)} {match.home_name}
        </span>
        <span className="shrink-0 tabular-nums text-brand-accent">
          {finished
            ? `${match.home_score}–${match.away_score}`
            : "vs"}
        </span>
        <span className="truncate text-right">
          {match.away_name} {wcTeamFlag(match.away_code)}
        </span>
      </div>
    </Link>
  );
}

function MiniGroupTable({
  group,
  labels,
}: {
  group: GroupTable;
  labels: { group: string; team: string; pts: string };
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/50">
      <div className="border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
        {labels.group} {group.group_letter}
      </div>
      <table className="w-full text-left text-xs">
        <tbody>
          {group.rows.map((row) => (
            <tr key={row.code} className="border-t border-border/50">
              <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                {row.rank}
              </td>
              <td className="px-2 py-1.5 font-medium text-foreground">
                {row.short_name}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-brand-accent">
                {row.points} {labels.pts}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  };
  picks_gw?: number;
};

function squadDisplayName(s: SquadSnapshot): string | null {
  const e = s.entry;
  if (!e) return null;
  if (e.name) return e.name;
  const parts = [e.player_first_name, e.player_last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function FplSection({
  todayFpl,
  locale,
  labels,
}: {
  todayFpl: HomeHubData["today"]["fpl"];
  locale: string;
  labels: {
    eyebrow: string;
    title: string;
    description: string;
    entryHint: string;
    deadline: string;
    gw: string;
    snapshotLoading: string;
    snapshotRank: string;
    snapshotPoints: string;
    snapshotGw: string;
    openDashboard: string;
    openPlanner: string;
    shortcuts: string;
  };
}) {
  const { entryId } = useEntryId();
  const [snapshot, setSnapshot] = useState<SquadSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const tNav = useTranslations("nav");

  useEffect(() => {
    if (!entryId) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    setSnapshotLoading(true);
    fetch(`/api/team/${entryId}`)
      .then(async (res) => {
        const data = (await res.json()) as SquadSnapshot & { error?: string };
        if (!res.ok) throw new Error(data.error);
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setSnapshotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  const shortcuts = [
    { href: entryId ? `/dashboard/${entryId}` : "/dashboard", label: tNav("dashboard") },
    { href: entryId ? `/planner/${entryId}` : "/planner", label: tNav("planner") },
    { href: entryId ? `/manager/${entryId}` : "/manager", label: tNav("manager") },
    { href: "/players", label: tNav("players") },
    { href: "/mini", label: tNav("mini") },
  ];

  return (
    <HubSection
      eyebrow={labels.eyebrow}
      title={labels.title}
      description={labels.description}
    >
      <div className="flex max-w-xl flex-col gap-4">
          {todayFpl.gw != null && todayFpl.deadline ? (
            <p className="text-sm text-muted-foreground">
              {labels.gw.replace("{gw}", String(todayFpl.gw))} ·{" "}
              {labels.deadline}{" "}
              <span className="text-foreground/70">
                {fmtDeadline(todayFpl.deadline, locale)}
              </span>
            </p>
          ) : null}

          <div className="rounded-xl border border-border bg-card p-4">
            <EntryIdForm redirectTo={(id) => `/dashboard/${id}`} />
            <p className="mt-2 text-xs text-muted-foreground">{labels.entryHint}</p>
          </div>

          {entryId ? (
            snapshotLoading ? (
              <div className="h-20 animate-pulse rounded-xl border border-border bg-card" />
            ) : snapshot ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="font-medium text-foreground">
                  {squadDisplayName(snapshot) ?? `#${entryId}`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {labels.snapshotRank.replace(
                    "{rank}",
                    snapshot.entry?.summary_overall_rank != null
                      ? snapshot.entry.summary_overall_rank.toLocaleString(locale)
                      : "—",
                  )}{" "}
                  ·{" "}
                  {labels.snapshotPoints.replace(
                    "{pts}",
                    String(snapshot.entry?.summary_overall_points ?? "—"),
                  )}
                  {snapshot.picks_gw
                    ? ` · ${labels.snapshotGw.replace("{gw}", String(snapshot.picks_gw))}`
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/${entryId}`}
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "no-underline",
                    )}
                  >
                    {labels.openDashboard}
                  </Link>
                  <Link
                    href={`/planner/${entryId}`}
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "no-underline",
                    )}
                  >
                    {labels.openPlanner}
                  </Link>
                </div>
              </div>
            ) : null
          ) : null}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labels.shortcuts}
            </p>
            <div className="flex flex-wrap gap-2">
              {shortcuts.map((s) => (
                <HubChip key={s.href} href={s.href}>
                  {s.label}
                </HubChip>
              ))}
            </div>
          </div>
      </div>
    </HubSection>
  );
}

const EXPLORE_TILES = [
  { href: "/chat", key: "chat" },
  { href: "/mini", key: "mini" },
  { href: "/players", key: "players" },
  { href: "/worldcup?tab=scouting", key: "scouting" },
  { href: "/worldcup?tab=matches", key: "matches" },
  { href: "/worldcup?tab=tables", key: "tables" },
] as const;

function ExploreSection({
  labels,
}: {
  labels: {
    title: string;
    tiles: Record<(typeof EXPLORE_TILES)[number]["key"], { title: string; body: string }>;
  };
}) {
  return (
    <HubSection title={labels.title}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXPLORE_TILES.map(({ href, key }) => (
          <Link
            key={key}
            href={href}
            className="group rounded-xl border border-border bg-card p-4 no-underline transition-colors hover:border-brand-accent/25 hover:bg-card"
          >
            <h3 className="font-semibold text-foreground group-hover:text-brand-accent">
              {labels.tiles[key].title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{labels.tiles[key].body}</p>
          </Link>
        ))}
      </div>
    </HubSection>
  );
}

export function HomeHub({ initialData }: { initialData?: HomeHubData | null }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const [data, setData] = useState<HomeHubData | null>(initialData ?? null);
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubLoading, setHubLoading] = useState(!initialData);

  useEffect(() => {
    let cancelled = false;

    async function fetchHub(attempt = 0): Promise<void> {
      if (attempt === 0) {
        setHubError(null);
        if (!data) setHubLoading(true);
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
      } finally {
        if (!cancelled) setHubLoading(false);
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
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 md:gap-10">
      <section className="flex flex-col gap-4">
        {hubLoading && !data ? (
          <div className="h-12 animate-pulse rounded-xl border border-border bg-card" />
        ) : (
          <>
            <TodayTicker
              items={hub.today.ticker}
              fpl={hub.today.fpl}
              locale={locale}
              labels={{
                result: t("todayResult"),
                upcoming: t("todayUpcoming"),
                fplDeadline: t("todayFpl"),
                fplGw: t("todayFplGw", { gw: String(hub.today.fpl.gw ?? "—") }),
                noItems: t("todayEmpty"),
              }}
            />
            {hubError ? (
              <p className="text-xs text-muted-foreground">{hubError}</p>
            ) : null}
          </>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <HubChip href="/worldcup" variant="accent">
          {t("ctaWorldCup")}
        </HubChip>
        <HubChip href="/fpl">{t("ctaFpl")}</HubChip>
        <HubChip href="/news">{t("ctaNews")}</HubChip>
        <HubChip href="/news?category=transfer">{t("ctaTransfers")}</HubChip>
      </section>

      {hub.news.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">{t("headlinesTitle")}</h2>
            <Link
              href="/news"
              className="text-xs font-medium text-brand-accent no-underline hover:underline"
            >
              {t("newsAll")}
            </Link>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card/40">
            {hub.news.slice(0, 6).map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 no-underline transition-colors hover:bg-muted/40"
                >
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.outlet}
                    {item.category ? ` · ${item.category}` : ""}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
