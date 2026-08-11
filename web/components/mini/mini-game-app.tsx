"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useEntryId } from "@/components/entry-id-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  countMiniByPosition,
  validateCaptaincy,
  validateMiniSquad,
  validatePartialSquad,
  type MiniPickInput,
} from "@/lib/mini/validate";
import type { MiniPickStored } from "@/lib/mini/types";
import { miniPlayerIdentityKey } from "@/lib/mini/player-identity";
import {
  MINI_GK_SLOT,
  MINI_SLOT_COUNT,
  MiniPitch,
} from "@/components/mini/mini-pitch";
import type { MiniPlayerDisplay } from "@/lib/mini/player-stats";
import { MiniModal, MiniModalActions } from "@/components/mini/mini-modal";
import { MiniPlayerPicker } from "@/components/mini/mini-player-picker";
import {
  MiniTemplates,
  type MiniTemplatePayload,
} from "@/components/mini/mini-templates";
import {
  MiniCrowdVsDiff,
  type MiniHotPickRow,
} from "@/components/mini/mini-crowd-vs-diff";
import { MiniMissionPanel } from "@/components/mini/mini-mission-panel";
import { MiniBadges } from "@/components/mini/mini-badges";
import { MiniShareCard } from "@/components/mini/mini-share-card";
import { MiniLeaguesPanel } from "@/components/mini/mini-leagues-panel";
import type { MiniBadgeId } from "@/lib/mini/badges";
import {
  evaluateMission,
  isDifferentialPick,
  type MiniMissionId,
} from "@/lib/mini/incentives";
import {
  MINI_NICKNAME_KEY,
  MINI_PROFILE_ID_KEY,
  MINI_USED_TEMPLATE_KEY,
  guestEntryIdFromProfileId,
  isValidNickname,
  newMiniProfileId,
  sanitizeNickname,
} from "@/lib/mini/profile";

const MINI_BADGES_KEY = "miniBadges";

type PlayerHit = MiniPlayerDisplay;

type MiniContext = {
  season: string;
  submission_gw: number | null;
  submission_open: boolean;
  deadline_time: string | null;
  scoring_gw: number;
  scoring_finished: boolean;
  mission?: {
    gw: number;
    id: MiniMissionId;
    titleKey: string;
    bodyKey: string;
  };
};

type LeaderboardRow = {
  rank: number;
  entry_id: number;
  entry_name: string | null;
  total_points: number;
  captain_name: string | null;
  differential_captain?: boolean;
  differential_bonus?: number;
  picks: MiniPickStored[];
  updated_at: string;
};

type SeasonRow = {
  rank: number;
  entry_id: number;
  entry_name: string | null;
  total_points: number;
  gws_played: number;
};

type TabId = "pick" | "leaderboard" | "season" | "social";

const EMPTY_SLOTS: (PlayerHit | null)[] = Array.from(
  { length: MINI_SLOT_COUNT },
  () => null,
);

function toPickInput(p: PlayerHit): MiniPickInput {
  return {
    fpl_id: p.fpl_id,
    position: p.position,
    team_id: p.team_id,
    web_name: p.web_name,
  };
}

function slotsToPicks(slots: (PlayerHit | null)[]): PlayerHit[] {
  return slots.filter((p): p is PlayerHit => p != null);
}

function picksToSlots(picks: PlayerHit[]): (PlayerHit | null)[] {
  const slots = [...EMPTY_SLOTS];
  const gk = picks.find((p) => p.position === "GKP");
  const rest = picks.filter((p) => p.position !== "GKP");
  if (gk) slots[MINI_GK_SLOT] = gk;
  rest.forEach((p, i) => {
    if (i + 1 < MINI_SLOT_COUNT) slots[i + 1] = p;
  });
  return slots;
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

function readLocal(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function MiniGameApp({ locale }: { locale: string }) {
  const t = useTranslations("mini");
  const { entryId: storedEntryId, setEntryId } = useEntryId();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [entryInput, setEntryInput] = useState("");
  const [ctx, setCtx] = useState<MiniContext | null>(null);
  const [slots, setSlots] = useState<(PlayerHit | null)[]>([...EMPTY_SLOTS]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceId, setViceId] = useState<number | null>(null);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [lbGw, setLbGw] = useState<number | null>(null);
  const [lbMeta, setLbMeta] = useState<{
    submission_gw: number | null;
    submission_open: boolean;
  } | null>(null);
  const [lbLoading, setLbLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("pick");
  const [templates, setTemplates] = useState<MiniTemplatePayload[]>([]);
  const [hotPicks, setHotPicks] = useState<MiniHotPickRow[]>([]);
  const [diffPicks, setDiffPicks] = useState<MiniHotPickRow[]>([]);
  const [hotEntries, setHotEntries] = useState(0);
  const [hotGw, setHotGw] = useState<number | null>(null);
  const [miniOwnedById, setMiniOwnedById] = useState<Record<number, number>>(
    {},
  );
  const [badges, setBadges] = useState<MiniBadgeId[]>([]);
  const [badgeFlash, setBadgeFlash] = useState<MiniBadgeId[]>([]);
  const [usedTemplate, setUsedTemplate] = useState(false);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);

  const picks = useMemo(() => slotsToPicks(slots), [slots]);
  const submissionOpen = Boolean(ctx?.submission_open);

  const effectiveEntryId = useMemo(() => {
    const typed = entryInput.trim();
    if (/^\d+$/.test(typed)) return Number(typed);
    if (profileId) return guestEntryIdFromProfileId(profileId);
    return null;
  }, [entryInput, profileId]);

  const myRank = useMemo(() => {
    if (effectiveEntryId == null) return null;
    return leaderboard.find((r) => r.entry_id === effectiveEntryId) ?? null;
  }, [leaderboard, effectiveEntryId]);

  useEffect(() => {
    let pid = readLocal(MINI_PROFILE_ID_KEY);
    if (!pid) {
      pid = newMiniProfileId();
      writeLocal(MINI_PROFILE_ID_KEY, pid);
    }
    setProfileId(pid);
    const nick = readLocal(MINI_NICKNAME_KEY);
    if (nick) setNickname(nick);
    if (readLocal(MINI_USED_TEMPLATE_KEY) === "1") setUsedTemplate(true);
    try {
      const raw = readLocal(MINI_BADGES_KEY);
      if (raw) setBadges(JSON.parse(raw) as MiniBadgeId[]);
    } catch {
      /* ignore */
    }
    if (storedEntryId) setEntryInput(storedEntryId);
  }, [storedEntryId]);

  const showNotice = useCallback((message: string) => {
    setNoticeMessage(message);
    setNoticeOpen(true);
  }, []);

  const absorbBadges = useCallback((unlocked: MiniBadgeId[]) => {
    if (!unlocked.length) return;
    setBadges((prev) => {
      const trulyNew = unlocked.filter((id) => !prev.includes(id));
      if (!trulyNew.length) return prev;
      const next = Array.from(new Set([...prev, ...trulyNew])) as MiniBadgeId[];
      writeLocal(MINI_BADGES_KEY, JSON.stringify(next));
      setBadgeFlash(trulyNew);
      showNotice(
        trulyNew.length === 1
          ? t("badgeUnlockedOne")
          : t("badgeUnlockedMany", { n: trulyNew.length }),
      );
      return next;
    });
  }, [showNotice, t]);

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

  const loadExtras = useCallback(async () => {
    const [tplRes, hotRes] = await Promise.all([
      fetch("/api/mini/templates"),
      fetch("/api/mini/hot-picks"),
    ]);
    if (tplRes.ok) {
      const data = (await tplRes.json()) as { templates?: MiniTemplatePayload[] };
      setTemplates(data.templates ?? []);
    }
    if (hotRes.ok) {
      const data = (await hotRes.json()) as {
        gw?: number;
        entries?: number;
        picks?: MiniHotPickRow[];
        differentials?: MiniHotPickRow[];
        owned_by_id?: Record<number, number>;
      };
      setHotGw(data.gw ?? null);
      setHotEntries(data.entries ?? 0);
      setHotPicks(data.picks ?? []);
      setDiffPicks(data.differentials ?? []);
      setMiniOwnedById(data.owned_by_id ?? {});
    }
  }, []);

  const loadProfile = useCallback(async (pid: string) => {
    const res = await fetch(
      `/api/mini/profile?profile_id=${encodeURIComponent(pid)}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      profile: {
        nickname?: string;
        fpl_entry_id?: number | null;
        badges?: MiniBadgeId[];
      } | null;
    };
    if (!data.profile) return;
    const profile = data.profile;
    if (profile.nickname) {
      setNickname(profile.nickname);
      writeLocal(MINI_NICKNAME_KEY, profile.nickname);
    }
    if (profile.fpl_entry_id) {
      setEntryInput(String(profile.fpl_entry_id));
    }
    setBadges((prev) => {
      const merged = Array.from(
        new Set([...(prev ?? []), ...(profile.badges ?? [])]),
      ) as MiniBadgeId[];
      writeLocal(MINI_BADGES_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const loadSeason = useCallback(async () => {
    setSeasonLoading(true);
    try {
      const res = await fetch("/api/mini/season-ladder");
      if (res.ok) {
        const data = (await res.json()) as { rows?: SeasonRow[] };
        setSeasonRows(data.rows ?? []);
      }
    } finally {
      setSeasonLoading(false);
    }
  }, []);

  const loadExistingEntry = useCallback(async (eid: number) => {
    const res = await fetch(`/api/mini/entry?entry_id=${eid}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      entry: {
        picks: MiniPickStored[];
        captain_fpl_id: number;
        vice_fpl_id: number;
      } | null;
    };
    if (!data.entry) return;
    const restored: PlayerHit[] = data.entry.picks.map((p) => ({
      fpl_id: p.fpl_id,
      web_name: p.web_name,
      team: p.team,
      team_id: p.team_id,
      position: p.position,
      base_price: p.base_price ?? null,
      status: p.status ?? null,
      form: p.form ?? null,
      total_points: p.total_points ?? null,
      points_per_game: p.points_per_game ?? null,
      selected_by_percent: p.selected_by_percent ?? null,
      goals_scored: p.goals_scored ?? null,
      assists: p.assists ?? null,
      expected_goals: p.expected_goals ?? null,
      expected_assists: p.expected_assists ?? null,
    }));
    setSlots(picksToSlots(restored));
    setCaptainId(data.entry.captain_fpl_id);
    setViceId(data.entry.vice_fpl_id);
  }, []);

  useEffect(() => {
    void loadContext();
    void loadLeaderboard();
    void loadExtras();
  }, [loadContext, loadLeaderboard, loadExtras]);

  useEffect(() => {
    if (profileId) void loadProfile(profileId);
  }, [profileId, loadProfile]);

  useEffect(() => {
    if (!ctx || ctx.scoring_finished) return;
    const id = window.setInterval(() => void loadLeaderboard(), 45_000);
    return () => window.clearInterval(id);
  }, [ctx, loadLeaderboard]);

  useEffect(() => {
    if (effectiveEntryId != null) void loadExistingEntry(effectiveEntryId);
  }, [effectiveEntryId, loadExistingEntry, ctx?.submission_gw]);

  useEffect(() => {
    if (activeTab === "season") void loadSeason();
  }, [activeTab, loadSeason]);

  const posCounts = useMemo(
    () => countMiniByPosition(picks.map(toPickInput)),
    [picks],
  );

  const validationIssues = useMemo(() => {
    const inputs = picks.map(toPickInput);
    const squad = validateMiniSquad(inputs);
    if (picks.length === 5 && captainId != null && viceId != null) {
      return [...squad, ...validateCaptaincy(inputs, captainId, viceId)];
    }
    if (picks.length === 5) {
      const extra = [];
      if (captainId == null) extra.push({ code: "captain", message: t("needCaptain") });
      if (viceId == null) extra.push({ code: "vice", message: t("needVice") });
      return [...squad, ...extra];
    }
    return squad;
  }, [picks, captainId, viceId, t]);

  const squadComplete = picks.length === 5 && validationIssues.length === 0;
  const nicknameOk = isValidNickname(nickname);
  const canSubmit = Boolean(
    submissionOpen && squadComplete && nicknameOk && profileId,
  );

  const missionLive = useMemo(() => {
    if (!ctx?.mission || picks.length !== 5 || captainId == null) {
      return { completed: false, diffCaptainReady: false };
    }
    const completed = evaluateMission({
      missionId: ctx.mission.id,
      picks: picks.map((p) => ({
        fpl_id: p.fpl_id,
        team_id: p.team_id,
        selected_by_percent: p.selected_by_percent,
      })),
      captainFplId: captainId,
      miniOwnedById,
      miniEntries: hotEntries,
    });
    const cap = picks.find((p) => p.fpl_id === captainId);
    const diffCaptainReady = isDifferentialPick({
      miniOwnedPct: miniOwnedById[captainId] ?? null,
      fplOwnedPct: cap?.selected_by_percent ?? null,
      miniEntries: hotEntries,
    });
    return { completed, diffCaptainReady };
  }, [ctx?.mission, picks, captainId, miniOwnedById, hotEntries]);

  function assignPlayerToSlot(slotIndex: number, player: PlayerHit) {
    if (slotIndex === MINI_GK_SLOT && player.position !== "GKP") {
      showNotice(t("gkSlotOnly"));
      return;
    }
    if (slotIndex !== MINI_GK_SLOT && player.position === "GKP") {
      showNotice(t("outfieldNoGk"));
      return;
    }

    const identity = miniPlayerIdentityKey(player);
    for (let i = 0; i < slots.length; i++) {
      if (i === slotIndex) continue;
      const existing = slots[i];
      if (existing && miniPlayerIdentityKey(existing) === identity) {
        showNotice(t("duplicatePlayer"));
        return;
      }
    }

    const next = [...slots];
    for (let i = 0; i < next.length; i++) {
      if (next[i]?.fpl_id === player.fpl_id) next[i] = null;
    }
    next[slotIndex] = player;

    const partial = slotsToPicks(next).map(toPickInput);
    const issues = validatePartialSquad(partial);
    if (issues.length > 0) {
      showNotice(issues[0]!.message);
      return;
    }

    setSlots(next);
    if (captainId == null && partial.length === 1) setCaptainId(player.fpl_id);
  }

  function clearSlot(slotIndex: number) {
    const removed = slots[slotIndex];
    const next = [...slots];
    next[slotIndex] = null;
    setSlots(next);
    if (removed) {
      if (captainId === removed.fpl_id) setCaptainId(null);
      if (viceId === removed.fpl_id) setViceId(null);
    }
  }

  function onSlotClick(slotIndex: number) {
    if (!submissionOpen) {
      showNotice(t("submissionsClosed"));
      return;
    }
    setPickerSlot(slotIndex);
  }

  function applyTemplate(tpl: MiniTemplatePayload) {
    if (!submissionOpen) {
      showNotice(t("submissionsClosed"));
      return;
    }
    const restored: PlayerHit[] = tpl.players.map((p) => ({
      fpl_id: p.fpl_id,
      web_name: p.web_name,
      team: p.team,
      team_id: p.team_id,
      position: p.position,
      base_price: p.base_price ?? null,
      status: p.status ?? null,
      form: p.form ?? null,
      total_points: p.total_points ?? null,
      points_per_game: p.points_per_game ?? null,
      selected_by_percent: p.selected_by_percent ?? null,
      goals_scored: p.goals_scored ?? null,
      assists: p.assists ?? null,
      expected_goals: p.expected_goals ?? null,
      expected_assists: p.expected_assists ?? null,
    }));
    setSlots(picksToSlots(restored));
    setCaptainId(tpl.captain_fpl_id);
    setViceId(tpl.vice_fpl_id);
    setUsedTemplate(true);
    writeLocal(MINI_USED_TEMPLATE_KEY, "1");
    showNotice(t("templateApplied"));
  }

  async function performSubmit() {
    if (!nicknameOk || !profileId) {
      showNotice(t("invalidNickname"));
      return;
    }
    if (!squadComplete) {
      showNotice(validationIssues[0]?.message ?? t("squadIncomplete"));
      return;
    }
    if (!ctx?.submission_open) {
      showNotice(t("submissionsClosed"));
      return;
    }

    setSubmitStatus("loading");
    const nick = sanitizeNickname(nickname);
    writeLocal(MINI_NICKNAME_KEY, nick);

    const typed = entryInput.trim();
    const fplId = /^\d+$/.test(typed) ? Number(typed) : null;
    if (fplId != null) setEntryId(String(fplId));

    const res = await fetch("/api/mini/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: profileId,
        nickname: nick,
        entry_id: fplId ?? undefined,
        picks: picks.map((p) => p.fpl_id),
        captain_fpl_id: captainId,
        vice_fpl_id: viceId,
        gw: ctx.submission_gw ?? undefined,
        used_template: usedTemplate,
      }),
    });

    const data = (await res.json()) as {
      error?: string;
      issues?: { message: string }[];
      newly_unlocked?: MiniBadgeId[];
    };
    if (!res.ok) {
      setSubmitStatus("error");
      showNotice(data.issues?.[0]?.message ?? data.error ?? t("submitFailed"));
      return;
    }
    setSubmitStatus("ok");
    if (data.newly_unlocked?.length) absorbBadges(data.newly_unlocked);
    void loadLeaderboard();
    void loadExtras();
    void loadProfile(profileId);
  }

  function onSubmitClick() {
    if (!canSubmit) {
      if (!nicknameOk) showNotice(t("invalidNickname"));
      else if (picks.length < 5) showNotice(t("needFivePlayers"));
      else if (validationIssues[0]) showNotice(validationIssues[0].message);
      else showNotice(t("submissionsClosed"));
      return;
    }
    setConfirmOpen(true);
  }

  const submissionGw = ctx?.submission_gw;
  const pickerTitle =
    pickerSlot === MINI_GK_SLOT ? t("pickerTitleGk") : t("pickerTitleOut");

  const tabs: { id: TabId; label: string }[] = [
    { id: "pick", label: t("tabPick") },
    { id: "leaderboard", label: t("tabLeaderboard") },
    { id: "season", label: t("tabSeason") },
    { id: "social", label: t("tabSocial") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground/70">
        <p>
          {ctx?.submission_open && submissionGw != null
            ? t("statusOpen", {
                gw: submissionGw,
                deadline: formatDeadline(ctx.deadline_time, locale),
              })
            : t("statusClosed", { gw: ctx?.scoring_gw ?? "—" })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t("rulesShort")}</p>
        <p className="mt-2 text-xs font-medium text-brand-accent">
          {t("diffCaptainReward", {
            pct: 10,
            bonus: 2,
          })}
          {missionLive.diffCaptainReady ? (
            <span className="ml-1 text-foreground/70">
              {t("diffCaptainReady")}
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              activeTab === tab.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "pick" ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("nicknameLabel")}
              </label>
              <Input
                placeholder={t("nicknamePlaceholder")}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="max-w-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("nicknameHint")}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("entryLabelOptional")}
              </label>
              <Input
                inputMode="numeric"
                pattern="\d*"
                placeholder={t("entryPlaceholder")}
                value={entryInput}
                onChange={(e) => setEntryInput(e.target.value)}
                className="max-w-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("entryOptionalHint")}
              </p>
            </div>
          </div>

          <MiniTemplates
            templates={templates}
            disabled={!submissionOpen}
            onApply={applyTemplate}
          />

          {ctx?.mission ? (
            <MiniMissionPanel
              gw={ctx.mission.gw}
              titleKey={ctx.mission.titleKey}
              bodyKey={ctx.mission.bodyKey}
              completed={missionLive.completed}
            />
          ) : null}

          <MiniCrowdVsDiff
            gw={hotGw}
            entries={hotEntries}
            crowd={hotPicks}
            differentials={diffPicks}
          />

          <div>
            <p className="mb-2 text-sm text-muted-foreground">{t("pitchHint")}</p>
            <p className="mb-3 text-xs text-muted-foreground">
              {t("posCounts", {
                gkp: posCounts.GKP,
                def: posCounts.DEF,
                mid: posCounts.MID,
                fwd: posCounts.FWD,
              })}
            </p>
            <MiniPitch
              slots={slots}
              captainId={captainId}
              viceId={viceId}
              activeSlot={pickerSlot}
              disabled={!submissionOpen}
              slotGkLabel={t("slotGk")}
              slotOutLabel={t("slotOut")}
              captainLabel={t("captain")}
              viceLabel={t("vice")}
              emptyLabel={t("tapToPick")}
              miniOwnedById={miniOwnedById}
              onSlotClick={onSlotClick}
              onSetCaptain={(id) => {
                if (!submissionOpen) return;
                setCaptainId(id);
                if (viceId === id) setViceId(null);
              }}
              onSetVice={(id) => {
                if (!submissionOpen) return;
                setViceId(id);
                if (captainId === id) setCaptainId(null);
              }}
            />
          </div>

          {submitStatus === "ok" ? (
            <p className="text-sm text-brand-accent">{t("submitOk")}</p>
          ) : null}

          <Button
            type="button"
            size="lg"
            disabled={!canSubmit || submitStatus === "loading"}
            className={cn(
              canSubmit &&
                "shadow-[0_0_28px_rgba(0,255,135,0.5)] ring-2 ring-brand-accent/40",
            )}
            onClick={onSubmitClick}
          >
            {submitStatus === "loading" ? t("submitting") : t("submit")}
          </Button>
          {!canSubmit && picks.length < 5 ? (
            <p className="text-center text-xs text-muted-foreground">
              {t("submitLocked")}
            </p>
          ) : null}

          <MiniShareCard
            locale={locale}
            nickname={sanitizeNickname(nickname) || "Manager"}
            gw={ctx?.submission_gw ?? lbGw}
            rank={myRank?.rank ?? null}
            totalPoints={myRank?.total_points ?? null}
            picks={picks}
            captainId={captainId}
          />

          <MiniBadges unlocked={badges} highlight={badgeFlash} />
        </div>
      ) : null}

      {activeTab === "leaderboard" ? (
        <div>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("leaderboardNextGw", { gw: lbMeta.submission_gw })}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void loadLeaderboard()}
            >
              {t("refresh")}
            </Button>
          </div>
          {lbLoading && leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noEntries")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
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
                      className="border-b border-border/60 hover:bg-card/50"
                    >
                      <td className="px-3 py-2 font-medium text-foreground">
                        {row.rank}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-foreground">
                          {row.entry_name ?? `#${row.entry_id}`}
                        </span>
                        {row.entry_id > 0 ? (
                          <span className="block text-xs text-muted-foreground">
                            {row.entry_id}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-semibold text-brand-accent">
                        {row.total_points}
                        {row.differential_captain ? (
                          <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                            {t("lbDiffCap")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-foreground/70">
                        {row.captain_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.picks.map((p) => p.web_name ?? p.fpl_id).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "season" ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t("seasonTitle")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("seasonHint")}</p>
          {seasonLoading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : seasonRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("seasonEmpty")}</p>
          ) : (
            <ol className="divide-y divide-border rounded-xl border border-border text-sm">
              {seasonRows.map((row) => (
                <li
                  key={`${row.entry_id}-${row.rank}`}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span>
                    #{row.rank}{" "}
                    <span className="font-medium">
                      {row.entry_name ?? `#${row.entry_id}`}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {row.total_points} · {t("leagueGws", { n: row.gws_played })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}

      {activeTab === "social" ? (
        <MiniLeaguesPanel profileId={profileId} onBadge={absorbBadges} />
      ) : null}

      <MiniPlayerPicker
        open={pickerSlot != null}
        title={pickerTitle}
        positionFilter={pickerSlot === MINI_GK_SLOT ? "GKP" : null}
        excludeIdentities={picks.map((p) => miniPlayerIdentityKey(p))}
        searchPlaceholder={t("searchPlaceholder")}
        searchingLabel={t("searching")}
        noResultsLabel={t("noResults")}
        clearSlotLabel={t("clearSlot")}
        showClear={pickerSlot != null && slots[pickerSlot!] != null}
        playersApi="/api/mini/players"
        onClose={() => setPickerSlot(null)}
        onClearSlot={() => {
          if (pickerSlot != null) clearSlot(pickerSlot);
        }}
        onSelect={(p) => {
          if (pickerSlot == null) return;
          assignPlayerToSlot(pickerSlot, {
            fpl_id: p.fpl_id,
            web_name: p.web_name,
            team: p.team,
            team_id: p.team_id ?? null,
            position: p.position,
            base_price: p.base_price ?? null,
            status: p.status ?? null,
            form: p.form ?? null,
            total_points: p.total_points ?? null,
            points_per_game: p.points_per_game ?? null,
            selected_by_percent: p.selected_by_percent ?? null,
            goals_scored: p.goals_scored ?? null,
            assists: p.assists ?? null,
            expected_goals: p.expected_goals ?? null,
            expected_assists: p.expected_assists ?? null,
          });
        }}
      />

      <MiniModal
        open={noticeOpen}
        title={t("noticeTitle")}
        onClose={() => setNoticeOpen(false)}
        actions={
          <Button type="button" onClick={() => setNoticeOpen(false)}>
            {t("noticeOk")}
          </Button>
        }
      >
        {noticeMessage}
      </MiniModal>

      <MiniModal
        open={confirmOpen}
        title={t("confirmTitle")}
        onClose={() => setConfirmOpen(false)}
        actions={
          <MiniModalActions
            cancelLabel={t("confirmNo")}
            confirmLabel={t("confirmYes")}
            confirmLoading={submitStatus === "loading"}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false);
              void performSubmit();
            }}
          />
        }
      >
        {t("confirmBody")}
      </MiniModal>
    </div>
  );
}
