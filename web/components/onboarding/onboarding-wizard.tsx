"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/auth-provider";
import { useEntryId } from "@/components/entry-id-context";
import { cn } from "@/lib/utils";

type Options = {
  fpl_teams: { id: number; name: string; short_name: string }[];
  wc_teams: { code: string; name: string; short_name: string }[];
  leagues: { id: string; label: string }[];
  news_regions: string[];
};

type FplHit = { fpl_id: number; web_name: string | null; name: string | null; team: string | null };
type WcHit = { id: number; name: string; team_code: string | null };

const STEPS = 5;

export function OnboardingWizard() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const { refresh } = useAuth();
  const { setEntryId } = useEntryId();

  const [step, setStep] = useState(0);
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nationalTeam, setNationalTeam] = useState("");
  const [leagues, setLeagues] = useState<string[]>(["epl"]);
  const [fplTeamId, setFplTeamId] = useState<number | "">("");
  const [fplTeamShort, setFplTeamShort] = useState("");
  const [regions, setRegions] = useState<string[]>(["GLOBAL"]);
  const [fplPlayers, setFplPlayers] = useState<FplHit[]>([]);
  const [wcPlayers, setWcPlayers] = useState<WcHit[]>([]);
  const [followedFpl, setFollowedFpl] = useState<FplHit[]>([]);
  const [followedWc, setFollowedWc] = useState<WcHit[]>([]);
  const [playerQ, setPlayerQ] = useState("");
  const [entryId, setEntryIdLocal] = useState("");

  useEffect(() => {
    void fetch("/api/account/onboarding-options")
      .then((r) => r.json())
      .then((d) => setOptions(d as Options))
      .catch(() => setError(t("loadError")));
  }, [t]);

  const searchPlayers = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setFplPlayers([]);
      setWcPlayers([]);
      return;
    }
    const [fplRes, wcRes] = await Promise.all([
      fetch(`/api/planner/players?q=${encodeURIComponent(q)}`),
      fetch(`/api/account/wc-players?q=${encodeURIComponent(q)}`),
    ]);
    const fplData = (await fplRes.json()) as { players?: FplHit[] };
    const wcData = (await wcRes.json()) as { players?: WcHit[] };
    setFplPlayers(fplData.players ?? []);
    setWcPlayers(wcData.players ?? []);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void searchPlayers(playerQ), 220);
    return () => window.clearTimeout(id);
  }, [playerQ, searchPlayers]);

  async function finish(skip = false) {
    setLoading(true);
    setError(null);
    try {
      const parsedEntry = entryId.trim();
      const fplEntry =
        parsedEntry && /^\d+$/.test(parsedEntry) ? Number(parsedEntry) : null;

      const res = await fetch("/api/account/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skip,
          national_team_code: nationalTeam || null,
          favorite_leagues: leagues,
          fpl_team_id: fplTeamId === "" ? null : fplTeamId,
          fpl_team_short_name: fplTeamShort || null,
          followed_fpl_player_ids: followedFpl.map((p) => p.fpl_id),
          followed_wc_player_ids: followedWc.map((p) => p.id),
          news_regions: regions,
          fpl_entry_id: fplEntry,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("saveError"));

      if (fplEntry) setEntryId(String(fplEntry));
      await refresh();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setLoading(false);
    }
  }

  function toggleLeague(id: string) {
    setLeagues((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleRegion(r: string) {
    setRegions((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  }

  if (!options) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex gap-1">
        {Array.from({ length: STEPS }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
              i <= step ? "bg-brand-accent" : "bg-muted",
            )}
          />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        {step === 0 ? (
          <>
            <h2 className="text-lg font-semibold text-foreground">{t("stepNational")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("stepNationalHint")}</p>
            <select
              value={nationalTeam}
              onChange={(e) => setNationalTeam(e.target.value)}
              className="mt-4 w-full rounded-lg border border-border bg-popover px-3 py-2 text-sm text-foreground"
            >
              <option value="">{t("skipOption")}</option>
              {options.wc_teams.map((team) => (
                <option key={team.code} value={team.code}>
                  {team.name}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="text-lg font-semibold text-foreground">{t("stepLeagues")}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {options.leagues.map((lg) => (
                <button
                  key={lg.id}
                  type="button"
                  onClick={() => toggleLeague(lg.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm",
                    leagues.includes(lg.id)
                      ? "bg-brand-accent/20 text-brand-accent"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {lg.id === "epl" ? t("leagueEpl") : t("leagueWc")}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="text-lg font-semibold text-foreground">{t("stepClub")}</h2>
            <select
              value={fplTeamId}
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw) {
                  setFplTeamId("");
                  setFplTeamShort("");
                  return;
                }
                const id = Number(raw);
                setFplTeamId(id);
                const hit = options.fpl_teams.find((t) => t.id === id);
                setFplTeamShort(hit?.short_name ?? "");
              }}
              className="mt-4 w-full rounded-lg border border-border bg-popover px-3 py-2 text-sm text-foreground"
            >
              <option value="">{t("skipOption")}</option>
              {options.fpl_teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="text-lg font-semibold text-foreground">{t("stepPlayers")}</h2>
            <Input
              className="mt-4"
              placeholder={t("playerSearch")}
              value={playerQ}
              onChange={(e) => setPlayerQ(e.target.value)}
            />
            <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
              {fplPlayers.map((p) => (
                <button
                  key={`fpl-${p.fpl_id}`}
                  type="button"
                  onClick={() =>
                    setFollowedFpl((prev) =>
                      prev.some((x) => x.fpl_id === p.fpl_id)
                        ? prev
                        : [...prev, p],
                    )
                  }
                  className="block w-full rounded px-2 py-1 text-left text-xs text-foreground/70 hover:bg-muted"
                >
                  {p.web_name ?? p.name} ({p.team}) · FPL
                </button>
              ))}
              {wcPlayers.map((p) => (
                <button
                  key={`wc-${p.id}`}
                  type="button"
                  onClick={() =>
                    setFollowedWc((prev) =>
                      prev.some((x) => x.id === p.id) ? prev : [...prev, p],
                    )
                  }
                  className="block w-full rounded px-2 py-1 text-left text-xs text-foreground/70 hover:bg-muted"
                >
                  {p.name} ({p.team_code}) · WC
                </button>
              ))}
            </div>
            {(followedFpl.length > 0 || followedWc.length > 0) ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("selectedCount", {
                  n: followedFpl.length + followedWc.length,
                })}
              </p>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2 className="text-lg font-semibold text-foreground">{t("stepEntry")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("stepEntryHint")}</p>
            <Input
              className="mt-4"
              inputMode="numeric"
              placeholder={t("entryPlaceholder")}
              value={entryId}
              onChange={(e) => setEntryIdLocal(e.target.value)}
            />
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">{t("stepRegions")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {options.news_regions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRegion(r)}
                    className={cn(
                      "rounded-full px-2 py-1 text-xs",
                      regions.includes(r)
                        ? "bg-brand-accent/20 text-brand-accent"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-rose-300">{error}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {step > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep((s) => s - 1)}
              disabled={loading}
            >
              {t("back")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => void finish(true)}
            disabled={loading}
          >
            {t("skipAll")}
          </Button>
          {step < STEPS - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              {t("next")}
            </Button>
          ) : (
            <Button type="button" onClick={() => void finish(false)} disabled={loading}>
              {loading ? t("saving") : t("finish")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
