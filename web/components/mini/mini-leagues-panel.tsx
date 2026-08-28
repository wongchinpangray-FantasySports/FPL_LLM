"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MiniBadgeId } from "@/lib/mini/badges";

type League = {
  id: string;
  code: string;
  name: string;
  season: string;
};

type Standing = {
  rank: number;
  entry_name: string | null;
  total_points: number;
  gws_played: number;
  gw_scores?: { gw: number; points: number }[];
};

export function MiniLeaguesPanel({
  profileId,
  onBadge,
}: {
  profileId: string | null;
  onBadge?: (badges: MiniBadgeId[]) => void;
}) {
  const t = useTranslations("mini");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    if (!profileId) return;
    const res = await fetch(
      `/api/mini/leagues?profile_id=${encodeURIComponent(profileId)}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as { leagues?: League[] };
    setLeagues(data.leagues ?? []);
  }, [profileId]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  async function createLeague() {
    if (!profileId) {
      setStatus(t("needNicknameFirst"));
      return;
    }
    setStatus(null);
    const res = await fetch("/api/mini/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        profile_id: profileId,
        name,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      league?: League;
      newly_unlocked?: MiniBadgeId[];
    };
    if (!res.ok) {
      setStatus(data.error ?? t("leagueFailed"));
      return;
    }
    if (data.newly_unlocked?.length) onBadge?.(data.newly_unlocked);
    setName("");
    void loadMine();
    if (data.league) {
      setActiveCode(data.league.code);
      void openStandings(data.league.code);
    }
  }

  async function joinLeague() {
    if (!profileId) {
      setStatus(t("needNicknameFirst"));
      return;
    }
    setStatus(null);
    const res = await fetch("/api/mini/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "join",
        profile_id: profileId,
        code,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      league?: League;
      newly_unlocked?: MiniBadgeId[];
    };
    if (!res.ok) {
      setStatus(data.error ?? t("leagueFailed"));
      return;
    }
    if (data.newly_unlocked?.length) onBadge?.(data.newly_unlocked);
    setCode("");
    void loadMine();
    if (data.league) {
      setActiveCode(data.league.code);
      void openStandings(data.league.code);
    }
  }

  async function openStandings(leagueCode: string) {
    setActiveCode(leagueCode);
    const res = await fetch(
      `/api/mini/leagues?code=${encodeURIComponent(leagueCode)}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as { standings?: Standing[] };
    setStandings(data.standings ?? []);
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {t("leaguesTitle")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("leaguesHint")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("leagueCreate")}
          </p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("leagueNamePlaceholder")}
          />
          <Button type="button" size="sm" onClick={() => void createLeague()}>
            {t("leagueCreateBtn")}
          </Button>
        </div>
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("leagueJoin")}
          </p>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t("leagueCodePlaceholder")}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void joinLeague()}
          >
            {t("leagueJoinBtn")}
          </Button>
        </div>
      </div>

      {status ? <p className="text-sm text-destructive">{status}</p> : null}

      {leagues.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("leagueMine")}</p>
          <ul className="space-y-1">
            {leagues.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="text-sm text-brand-accent hover:underline"
                  onClick={() => void openStandings(l.code)}
                >
                  {l.name} · {l.code}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {activeCode ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">
            {t("leagueStandings", { code: activeCode })}
          </h4>
          {standings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("leagueStandingsEmpty")}</p>
          ) : (
            <ol className="divide-y divide-border rounded-lg border border-border text-sm">
              {standings.map((s) => (
                <li
                  key={`${s.rank}-${s.entry_name}`}
                  className="flex items-start justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p>
                      #{s.rank} {s.entry_name ?? "—"}
                    </p>
                    {s.gw_scores && s.gw_scores.length > 0 ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {s.gw_scores
                          .map((g) =>
                            t("seasonGwPts", { gw: g.gw, pts: g.points }),
                          )
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums text-foreground">
                      {t("seasonTotalPts", { n: s.total_points })}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("leagueGws", { n: s.gws_played })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
