"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useEntryId } from "@/components/entry-id-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countMiniByPosition,
  validateCaptaincy,
  validateMiniSquad,
  type MiniPickInput,
} from "@/lib/mini/validate";
import type { MiniPickStored } from "@/lib/mini/types";

type PlayerHit = {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
};

type MiniContext = {
  season: string;
  submission_gw: number | null;
  submission_open: boolean;
  deadline_time: string | null;
  scoring_gw: number;
  scoring_finished: boolean;
};

type LeaderboardRow = {
  rank: number;
  entry_id: number;
  entry_name: string | null;
  total_points: number;
  captain_name: string | null;
  picks: MiniPickStored[];
  updated_at: string;
};

function toPickInput(p: PlayerHit): MiniPickInput {
  return {
    fpl_id: p.fpl_id,
    position: p.position,
    team_id: p.team_id,
  };
}

function formatDeadline(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(locale === "zh" ? "zh-CN" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function MiniGameApp({ locale }: { locale: string }) {
  const t = useTranslations("mini");
  const { entryId: storedEntryId, setEntryId } = useEntryId();
  const [entryInput, setEntryInput] = useState("");
  const [ctx, setCtx] = useState<MiniContext | null>(null);
  const [picks, setPicks] = useState<PlayerHit[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceId, setViceId] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<PlayerHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [lbGw, setLbGw] = useState<number | null>(null);
  const [lbMeta, setLbMeta] = useState<{
    submission_gw: number | null;
    submission_open: boolean;
  } | null>(null);
  const [lbLoading, setLbLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pick" | "leaderboard">("pick");

  const entryId = entryInput.trim() || storedEntryId || "";

  useEffect(() => {
    if (storedEntryId) setEntryInput(storedEntryId);
  }, [storedEntryId]);

  const loadContext = useCallback(async () => {
    const res = await fetch("/api/mini/context");
    if (res.ok) setCtx((await res.json()) as MiniContext);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const res = await fetch("/api/mini/leaderboard");
      const data = (await res.json()) as {
        rows?: LeaderboardRow[];
        gw?: number;
        submission_gw?: number | null;
        submission_open?: boolean;
        error?: string;
      };
      if (res.ok) {
        setLeaderboard(data.rows ?? []);
        setLbGw(data.gw ?? null);
        setLbMeta({
          submission_gw: data.submission_gw ?? null,
          submission_open: Boolean(data.submission_open),
        });
      }
    } finally {
      setLbLoading(false);
    }
  }, []);

  const loadExistingEntry = useCallback(async (eid: string) => {
    if (!/^\d+$/.test(eid)) return;
    const res = await fetch(`/api/mini/entry?entry_id=${encodeURIComponent(eid)}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      entry: {
        picks: MiniPickStored[];
        captain_fpl_id: number;
        vice_fpl_id: number;
      } | null;
    };
    if (!data.entry) {
      setPicks([]);
      setCaptainId(null);
      setViceId(null);
      return;
    }
    const restored: PlayerHit[] = data.entry.picks.map((p) => ({
      fpl_id: p.fpl_id,
      web_name: p.web_name,
      name: p.web_name,
      team: p.team,
      team_id: p.team_id,
      position: p.position,
      base_price: null,
    }));
    setPicks(restored);
    setCaptainId(data.entry.captain_fpl_id);
    setViceId(data.entry.vice_fpl_id);
  }, []);

  useEffect(() => {
    void loadContext();
    void loadLeaderboard();
  }, [loadContext, loadLeaderboard]);

  useEffect(() => {
    if (!ctx || ctx.scoring_finished) return;
    const id = window.setInterval(() => void loadLeaderboard(), 45_000);
    return () => window.clearInterval(id);
  }, [ctx, loadLeaderboard]);

  useEffect(() => {
    if (entryId && /^\d+$/.test(entryId)) void loadExistingEntry(entryId);
  }, [entryId, loadExistingEntry, ctx?.submission_gw]);

  useEffect(() => {
    const trimmed = searchQ.trim();
    if (trimmed.length < 2) {
      setSearchHits([]);
      return;
    }
    const id = window.setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        try {
          const res = await fetch(
            `/api/planner/players?q=${encodeURIComponent(trimmed)}`,
          );
          const data = (await res.json()) as { players?: PlayerHit[] };
          setSearchHits(data.players ?? []);
        } catch {
          setSearchHits([]);
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 220);
    return () => window.clearTimeout(id);
  }, [searchQ]);

  const posCounts = useMemo(() => countMiniByPosition(picks.map(toPickInput)), [picks]);

  const validationIssues = useMemo(() => {
    const inputs = picks.map(toPickInput);
    const squad = validateMiniSquad(inputs);
    if (captainId != null && viceId != null) {
      return [...squad, ...validateCaptaincy(inputs, captainId, viceId)];
    }
    if (picks.length === 5) {
      if (captainId == null) {
        return [...squad, { code: "captain", message: t("needCaptain") }];
      }
      if (viceId == null) {
        return [...squad, { code: "vice", message: t("needVice") }];
      }
    }
    return squad;
  }, [picks, captainId, viceId, t]);

  function tryAddPlayer(p: PlayerHit) {
    if (picks.some((x) => x.fpl_id === p.fpl_id)) return;
    if (picks.length >= 5) return;
    const next = [...picks, p];
    const issues = validateMiniSquad(next.map(toPickInput));
    if (issues.length > 0) {
      setSubmitError(issues[0]!.message);
      return;
    }
    setSubmitError(null);
    setPicks(next);
    if (next.length === 1 && captainId == null) setCaptainId(p.fpl_id);
  }

  function removePlayer(fplId: number) {
    setPicks((prev) => prev.filter((p) => p.fpl_id !== fplId));
    if (captainId === fplId) setCaptainId(null);
    if (viceId === fplId) setViceId(null);
    setSubmitError(null);
  }

  async function onSubmit() {
    const eid = entryInput.trim();
    if (!/^\d+$/.test(eid)) {
      setSubmitError(t("invalidEntry"));
      return;
    }
    if (validationIssues.length > 0) {
      setSubmitError(validationIssues[0]!.message);
      return;
    }
    if (!ctx?.submission_open) {
      setSubmitError(t("submissionsClosed"));
      return;
    }

    setSubmitStatus("loading");
    setSubmitError(null);
    setEntryId(eid);

    const res = await fetch("/api/mini/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_id: Number(eid),
        picks: picks.map((p) => p.fpl_id),
        captain_fpl_id: captainId,
        vice_fpl_id: viceId,
        gw: ctx.submission_gw ?? undefined,
      }),
    });

    const data = (await res.json()) as { error?: string; issues?: { message: string }[] };
    if (!res.ok) {
      setSubmitStatus("error");
      setSubmitError(
        data.issues?.[0]?.message ?? data.error ?? t("submitFailed"),
      );
      return;
    }
    setSubmitStatus("ok");
    void loadLeaderboard();
  }

  const submissionGw = ctx?.submission_gw;
  const canSubmit = Boolean(ctx?.submission_open && picks.length === 5);

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
        <p>
          {ctx?.submission_open && submissionGw != null
            ? t("statusOpen", {
                gw: submissionGw,
                deadline: formatDeadline(ctx.deadline_time, locale),
              })
            : t("statusClosed", { gw: ctx?.scoring_gw ?? "—" })}
        </p>
        <p className="mt-1 text-xs text-slate-500">{t("rulesShort")}</p>
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("pick")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            activeTab === "pick"
              ? "bg-white/10 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          {t("tabPick")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("leaderboard")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            activeTab === "leaderboard"
              ? "bg-white/10 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          {t("tabLeaderboard")}
        </button>
      </div>

      {activeTab === "pick" ? (
        <div className="flex flex-col gap-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("entryLabel")}
            </label>
            <Input
              inputMode="numeric"
              pattern="\d*"
              placeholder={t("entryPlaceholder")}
              value={entryInput}
              onChange={(e) => setEntryInput(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <div>
            <p className="mb-2 text-sm text-slate-400">{t("squadTitle")}</p>
            <p className="mb-3 text-xs text-slate-500">
              {t("posCounts", {
                gkp: posCounts.GKP,
                def: posCounts.DEF,
                mid: posCounts.MID,
                fwd: posCounts.FWD,
              })}
            </p>
            <ul className="flex flex-col gap-2">
              {picks.map((p) => {
                const label = p.web_name ?? p.name ?? `#${p.fpl_id}`;
                const isCap = captainId === p.fpl_id;
                const isVice = viceId === p.fpl_id;
                return (
                  <li
                    key={p.fpl_id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 font-medium text-white">
                      {label}{" "}
                      <span className="text-slate-500">
                        {p.position} · {p.team}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={isCap ? "primary" : "secondary"}
                      onClick={() => setCaptainId(p.fpl_id)}
                    >
                      {t("captain")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={isVice ? "primary" : "secondary"}
                      onClick={() => setViceId(p.fpl_id)}
                    >
                      {t("vice")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removePlayer(p.fpl_id)}
                    >
                      {t("remove")}
                    </Button>
                  </li>
                );
              })}
              {picks.length < 5 && (
                <li className="text-sm text-slate-500">{t("slotsLeft", { n: 5 - picks.length })}</li>
              )}
            </ul>
          </div>

          {ctx?.submission_open && picks.length < 5 ? (
            <div>
              <label className="mb-2 block text-sm text-slate-400">
                {t("searchLabel")}
              </label>
              <input
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full max-w-xl rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              />
              {searchLoading ? (
                <p className="mt-2 text-xs text-slate-500">{t("searching")}</p>
              ) : null}
              {searchHits.length > 0 ? (
                <ul className="mt-2 max-w-xl divide-y divide-white/10 rounded-xl border border-white/10">
                  {searchHits.map((p) => (
                    <li key={p.fpl_id}>
                      <button
                        type="button"
                        onClick={() => tryAddPlayer(p)}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-white/5"
                      >
                        <span className="text-white">
                          {p.web_name ?? p.name}{" "}
                          <span className="text-slate-500">
                            {p.position} · {p.team}
                          </span>
                        </span>
                        <span className="text-slate-500">
                          £{p.base_price ?? "—"}m
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {submitError ? (
            <p className="text-sm text-red-400" role="alert">
              {submitError}
            </p>
          ) : null}

          {submitStatus === "ok" ? (
            <p className="text-sm text-brand-accent">{t("submitOk")}</p>
          ) : null}

          <Button
            type="button"
            disabled={!canSubmit || submitStatus === "loading"}
            onClick={() => void onSubmit()}
          >
            {submitStatus === "loading" ? t("submitting") : t("submit")}
          </Button>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-sm text-slate-400">
              <p>
                {t("leaderboardGw", { gw: lbGw ?? "—" })}
                {!ctx?.scoring_finished ? (
                  <span className="ml-2 text-xs text-brand-accent">
                    {t("liveRefresh")}
                  </span>
                ) : null}
              </p>
              {lbMeta?.submission_open &&
              lbMeta.submission_gw != null &&
              lbGw != null &&
              lbMeta.submission_gw !== lbGw ? (
                <p className="mt-1 text-xs text-slate-500">
                  {t("leaderboardNextGw", { gw: lbMeta.submission_gw })}
                </p>
              ) : null}
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={() => void loadLeaderboard()}>
              {t("refresh")}
            </Button>
          </div>
          {lbLoading && leaderboard.length === 0 ? (
            <p className="text-sm text-slate-500">{t("loading")}</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noEntries")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2">{t("colRank")}</th>
                    <th className="px-3 py-2">{t("colEntry")}</th>
                    <th className="px-3 py-2">{t("colPoints")}</th>
                    <th className="px-3 py-2">{t("colCaptain")}</th>
                    <th className="px-3 py-2">{t("colSquad")}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr
                      key={row.entry_id}
                      className="border-b border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-2 font-medium text-white">
                        {row.rank}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-white">
                          {row.entry_name ?? `#${row.entry_id}`}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {row.entry_id}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-brand-accent">
                        {row.total_points}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {row.captain_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {row.picks
                          .map((p) => p.web_name ?? p.fpl_id)
                          .join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
