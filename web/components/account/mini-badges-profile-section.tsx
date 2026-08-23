"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MiniBadges } from "@/components/mini/mini-badges";
import type { MiniBadgeId } from "@/lib/mini/badges";
import type { MiniBadgeEventRow } from "@/lib/mini/badge-events";
import {
  MINI_PROFILE_ID_KEY,
  MINI_NICKNAME_KEY,
} from "@/lib/mini/profile";

type MiniProfilePayload = {
  id: string;
  nickname: string | null;
  badges: MiniBadgeId[];
  badge_count: number;
  badge_events: MiniBadgeEventRow[];
  season: string;
};

function readLocal(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function MiniBadgesProfileSection({
  fplEntryId,
}: {
  fplEntryId?: number | null;
}) {
  const t = useTranslations("account");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MiniProfilePayload | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    try {
      const localProfileId = readLocal(MINI_PROFILE_ID_KEY);
      const url = fplEntryId
        ? `/api/mini/profile?fpl_entry_id=${fplEntryId}`
        : localProfileId
          ? `/api/mini/profile?profile_id=${encodeURIComponent(localProfileId)}`
          : null;

      if (!url) {
        setProfile(null);
        setMissing(true);
        return;
      }

      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as { profile: MiniProfilePayload | null };
      if (!res.ok || !data.profile) {
        setProfile(null);
        setMissing(true);
        return;
      }
      setProfile(data.profile);
    } catch {
      setProfile(null);
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [fplEntryId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("miniBadgesLoading")}</p>
    );
  }

  if (missing || !profile) {
    const nickname = readLocal(MINI_NICKNAME_KEY);
    return (
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("miniBadgesTitle")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("miniBadgesEmpty")}</p>
        {nickname ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("miniBadgesGuestHint", { name: nickname })}
          </p>
        ) : null}
        <Link
          href="/play/mini"
          className="mt-3 inline-flex text-sm font-medium text-brand-accent hover:underline"
        >
          {t("miniBadgesPlay")} →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-accent/20 bg-brand-accent/[0.04] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t("miniBadgesTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("miniBadgesHint", {
              name: profile.nickname ?? "—",
              season: profile.season,
            })}
          </p>
        </div>
        <Link
          href="/play/mini"
          className="text-xs font-medium text-brand-accent hover:underline"
        >
          {t("miniBadgesOpen")} →
        </Link>
      </div>
      <MiniBadges
        unlocked={profile.badges}
        events={profile.badge_events}
        showHistory
        compact
      />
    </div>
  );
}
