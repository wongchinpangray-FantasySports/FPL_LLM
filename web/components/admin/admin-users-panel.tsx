"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { AdminUserRow } from "@/lib/admin/users";

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

function OnboardingDetails({
  user,
  labels,
}: {
  user: AdminUserRow;
  labels: {
    skipped: string;
    notCompleted: string;
    nationalTeam: string;
    leagues: string;
    fplClub: string;
    fplPlayers: string;
    wcPlayers: string;
    newsRegions: string;
    fplEntry: string;
    none: string;
  };
}) {
  const ob = user.onboarding;
  if (!ob.completed_at) {
    return (
      <p className="text-sm text-muted-foreground">{labels.notCompleted}</p>
    );
  }
  if (ob.skipped) {
    return (
      <p className="text-sm text-amber-200/90">
        {labels.skipped} · {fmtWhen(ob.completed_at, "en")}
      </p>
    );
  }

  const list = (items: { name: string }[]) =>
    items.length > 0 ? items.map((p) => p.name).join(", ") : labels.none;

  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs uppercase text-muted-foreground">
          {labels.nationalTeam}
        </dt>
        <dd className="text-foreground/90">
          {ob.national_team_name ?? labels.none}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase text-muted-foreground">
          {labels.leagues}
        </dt>
        <dd className="text-foreground/90">
          {ob.favorite_leagues.length > 0
            ? ob.favorite_leagues.join(", ")
            : labels.none}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase text-muted-foreground">
          {labels.fplClub}
        </dt>
        <dd className="text-foreground/90">{ob.fpl_team_name ?? labels.none}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase text-muted-foreground">
          {labels.fplEntry}
        </dt>
        <dd className="text-foreground/90">
          {user.fpl_entry_id ?? labels.none}
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs uppercase text-muted-foreground">
          {labels.fplPlayers}
        </dt>
        <dd className="text-foreground/90">
          {list(ob.followed_fpl_players)}
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs uppercase text-muted-foreground">
          {labels.wcPlayers}
        </dt>
        <dd className="text-foreground/90">
          {list(ob.followed_wc_players)}
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs uppercase text-muted-foreground">
          {labels.newsRegions}
        </dt>
        <dd className="text-foreground/90">
          {ob.news_regions.length > 0
            ? ob.news_regions.join(", ")
            : labels.none}
        </dd>
      </div>
    </dl>
  );
}

export function AdminUsersPanel({ locale }: { locale: string }) {
  const t = useTranslations("admin");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = (await res.json()) as {
        users?: AdminUserRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("loadError"));
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q) ||
        String(u.fpl_entry_id ?? "").includes(q),
    );
  }, [users, query]);

  const onboardedCount = users.filter((u) => u.onboarding.completed_at).length;

  const detailLabels = {
    skipped: t("onboardingSkipped"),
    notCompleted: t("onboardingPending"),
    nationalTeam: t("nationalTeam"),
    leagues: t("favoriteLeagues"),
    fplClub: t("fplClub"),
    fplPlayers: t("followedFplPlayers"),
    wcPlayers: t("followedWcPlayers"),
    newsRegions: t("newsRegions"),
    fplEntry: t("fplEntry"),
    none: t("none"),
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-accent">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("summary")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="min-w-[12rem] flex-1 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground/80 hover:border-brand-accent/40 disabled:opacity-50"
        >
          {t("refresh")}
        </button>
        <p className="text-xs text-muted-foreground">
          {t("stats", {
            total: users.length,
            onboarded: onboardedCount,
          })}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-card/80 text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">{t("colEmail")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("colSignedUp")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("colLastLogin")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("colOnboarding")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("colLogins")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const expanded = expandedId === user.id;
                  const ob = user.onboarding;
                  const obLabel = !ob.completed_at
                    ? t("statusPending")
                    : ob.skipped
                      ? t("statusSkipped")
                      : t("statusComplete");
                  return (
                    <Fragment key={user.id}>
                      <tr
                        className="border-b border-border/60 hover:bg-card/40"
                      >
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(expanded ? null : user.id)
                            }
                            className="text-left font-medium text-foreground hover:text-brand-accent"
                          >
                            {user.email ?? user.id.slice(0, 8)}
                          </button>
                          {user.fpl_entry_id ? (
                            <p className="text-xs text-muted-foreground">
                              FPL #{user.fpl_entry_id}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {fmtWhen(user.created_at, locale)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {fmtWhen(user.last_sign_in_at, locale)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                              !ob.completed_at &&
                                "bg-muted text-muted-foreground",
                              ob.completed_at &&
                                ob.skipped &&
                                "bg-amber-500/15 text-amber-200",
                              ob.completed_at &&
                                !ob.skipped &&
                                "bg-emerald-500/15 text-emerald-200",
                            )}
                          >
                            {obLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                          {user.login_days}
                        </td>
                      </tr>
                      {expanded ? (
                        <tr key={`${user.id}-detail`} className="bg-card/30">
                          <td colSpan={5} className="px-3 py-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("onboardingAnswers")}
                            </p>
                            <OnboardingDetails
                              user={user}
                              labels={detailLabels}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">{t("empty")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
