"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TeamTheme } from "@/lib/team-themes";

type AccountDetails = {
  email: string;
  profile: {
    login_days: number;
    fpl_entry_id: number | null;
    onboarding_completed_at: string | null;
    theme_team_type: "club" | "national";
  };
  preferences: {
    national_team: { code: string; name: string; short_name: string } | null;
    favorite_leagues: string[];
    fpl_club: { id: number; name: string; short_name: string } | null;
    followed_fpl_players: { id: number; name: string }[];
    followed_wc_players: { id: number; name: string }[];
    news_regions: string[];
  } | null;
  theme: TeamTheme;
  theme_team_type: "club" | "national";
};

function leagueLabel(id: string, t: (k: string) => string): string {
  if (id === "epl") return t("leagueEpl");
  if (id === "wc") return t("leagueWc");
  return id.toUpperCase();
}

export function AccountPanel() {
  const t = useTranslations("account");
  const { user, loading: authLoading } = useAuth();
  const [details, setDetails] = useState<AccountDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeSaving, setThemeSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/details");
      const data = (await res.json()) as AccountDetails & { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("loadError"));
      setDetails(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  async function setTheme(type: "club" | "national") {
    if (!details || themeSaving) return;
    setThemeSaving(true);
    try {
      const res = await fetch("/api/account/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_team_type: type }),
      });
      const data = (await res.json()) as {
        theme?: TeamTheme;
        theme_team_type?: "club" | "national";
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("themeError"));
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              theme: data.theme ?? prev.theme,
              theme_team_type: data.theme_team_type ?? type,
              profile: { ...prev.profile, theme_team_type: type },
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("themeError"));
    } finally {
      setThemeSaving(false);
    }
  }

  if (authLoading || loading) {
    return <p className="text-sm text-slate-400">{t("loading")}</p>;
  }

  if (!user) {
    return (
      <p className="text-sm text-slate-400">
        {t("signedOut")}{" "}
        <Link href="/auth/login" className="text-brand-accent hover:underline">
          {t("signIn")}
        </Link>
      </p>
    );
  }

  if (error && !details) {
    return (
      <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        {error}
      </p>
    );
  }

  if (!details) return null;

  const theme = details.theme;
  const prefs = details.preferences;
  const canClubTheme = Boolean(prefs?.fpl_club);
  const canNationalTheme = Boolean(prefs?.national_team);

  const style = {
    "--team-primary": theme.primary,
    "--team-secondary": theme.secondary,
    "--team-accent": theme.accent,
  } as React.CSSProperties;

  return (
    <section
      style={style}
      className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] shadow-xl"
    >
      <div
        className="relative px-6 py-8"
        style={{
          background: `linear-gradient(135deg, ${theme.secondary} 0%, color-mix(in srgb, ${theme.primary} 35%, #0a1628) 55%, ${theme.primary}22 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(circle at 85% 20%, ${theme.primary}, transparent 45%)`,
          }}
        />
        <p className="relative text-xs font-medium uppercase tracking-widest text-white/60">
          {theme.label}
        </p>
        <h1 className="relative mt-1 text-2xl font-semibold text-white">
          {t("title")}
        </h1>
        <p className="relative mt-1 text-sm text-white/75">{details.email}</p>
        <div className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-1 text-sm text-white">
          <span className="font-semibold tabular-nums">{details.profile.login_days}</span>
          <span className="text-white/70">{t("loginDays")}</span>
        </div>
      </div>

      <div className="space-y-6 bg-white/[0.03] p-6">
        {(canClubTheme || canNationalTheme) ? (
          <div>
            <h2 className="text-sm font-medium text-slate-300">{t("pageTheme")}</h2>
            <p className="mt-1 text-xs text-slate-500">{t("pageThemeHint")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={details.theme_team_type === "club" ? "primary" : "secondary"}
                disabled={!canClubTheme || themeSaving}
                onClick={() => void setTheme("club")}
                style={
                  details.theme_team_type === "club"
                    ? { backgroundColor: theme.primary, color: theme.secondary }
                    : undefined
                }
              >
                {t("themeClub")}
                {prefs?.fpl_club ? ` · ${prefs.fpl_club.short_name}` : ""}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={details.theme_team_type === "national" ? "primary" : "secondary"}
                disabled={!canNationalTheme || themeSaving}
                onClick={() => void setTheme("national")}
                style={
                  details.theme_team_type === "national"
                    ? { backgroundColor: theme.primary, color: theme.secondary }
                    : undefined
                }
              >
                {t("themeNational")}
                {prefs?.national_team ? ` · ${prefs.national_team.short_name}` : ""}
              </Button>
            </div>
          </div>
        ) : null}

        <div>
          <h2 className="text-sm font-medium text-slate-300">{t("yourPreferences")}</h2>
          {!prefs ? (
            <p className="mt-2 text-sm text-slate-500">{t("noPreferences")}</p>
          ) : (
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              <PrefBlock label={t("nationalTeam")} value={prefs.national_team?.name ?? t("notSet")} />
              <PrefBlock
                label={t("leagues")}
                value={
                  prefs.favorite_leagues.length
                    ? prefs.favorite_leagues.map((l) => leagueLabel(l, t)).join(", ")
                    : t("notSet")
                }
              />
              <PrefBlock label={t("fplClub")} value={prefs.fpl_club?.name ?? t("notSet")} />
              <PrefBlock label={t("fplEntry")} value={String(details.profile.fpl_entry_id ?? t("notSet"))} />
              <PrefBlock
                label={t("players")}
                value={
                  [...prefs.followed_fpl_players, ...prefs.followed_wc_players]
                    .map((p) => p.name)
                    .join(", ") || t("notSet")
                }
                className="sm:col-span-2"
              />
              <PrefBlock
                label={t("newsRegions")}
                value={prefs.news_regions.join(", ") || t("notSet")}
                className="sm:col-span-2"
              />
            </dl>
          )}
        </div>

        {!details.profile.onboarding_completed_at ? (
          <Link
            href="/onboarding"
            className="inline-block text-sm hover:underline"
            style={{ color: theme.primary }}
          >
            {t("finishOnboarding")}
          </Link>
        ) : (
          <Link
            href="/onboarding"
            className="inline-block text-sm text-slate-400 hover:text-white"
          >
            {t("editPreferences")}
          </Link>
        )}
      </div>
    </section>
  );
}

function PrefBlock({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-white/[0.02] p-3",
        className,
      )}
    >
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-white">{value}</dd>
    </div>
  );
}
