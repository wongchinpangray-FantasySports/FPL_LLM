"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  countWcMiniByPosition,
  validateWcCaptaincy,
  validateWcMiniSquad,
  validateWcPartialSquad,
  type WcMiniPickInput,
} from "@/lib/wc-mini/validate";
import type { WcMiniPickStored } from "@/lib/wc-mini/types";
import {
  MINI_GK_SLOT,
  MINI_SLOT_COUNT,
  MiniPitch,
} from "@/components/mini/mini-pitch";
import type { MiniPlayerDisplay } from "@/lib/mini/player-stats";
import { MiniModal, MiniModalActions } from "@/components/mini/mini-modal";
import { MiniPlayerPicker } from "@/components/mini/mini-player-picker";

type PlayerHit = MiniPlayerDisplay;

const WC_MINI_TAG_KEY = "wcMiniEntryTag";

type WcMiniContext = {
  season: string;
  submission_matchday: number | null;
  submission_open: boolean;
  deadline_time: string | null;
  scoring_matchday: number;
  scoring_finished: boolean;
};

type LeaderboardRow = {
  rank: number;
  entry_tag: string;
  entry_name: string | null;
  total_points: number;
  captain_name: string | null;
  picks: WcMiniPickStored[];
  updated_at: string;
};

const EMPTY_SLOTS: (PlayerHit | null)[] = Array.from(
  { length: MINI_SLOT_COUNT },
  () => null,
);

function toPickInput(p: PlayerHit): WcMiniPickInput {
  return {
    player_id: p.fpl_id,
    position: p.position,
    wc_team_id: p.team_id,
  };
}

function normalizeTag(raw: string): string | null {
  const tag = raw.trim().toLowerCase();
  if (tag.length < 2 || tag.length > 40) return null;
  if (!/^[a-z0-9_-]+$/.test(tag)) return null;
  return tag;
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

export function WcMiniGameApp({ locale }: { locale: string }) {
  const t = useTranslations("wcMini");
  const [entryInput, setEntryInput] = useState("");
  const [ctx, setCtx] = useState<WcMiniContext | null>(null);
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
    submission_matchday: number | null;
    submission_open: boolean;
  } | null>(null);
  const [lbLoading, setLbLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pick" | "leaderboard">("pick");

  const entryTag = normalizeTag(entryInput) ?? "";
  const submissionOpen = Boolean(ctx?.submission_open);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(WC_MINI_TAG_KEY);
      if (stored) setEntryInput(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const showNotice = useCallback((message: string) => {
    setNoticeMessage(message);
    setNoticeOpen(true);
  }, []);

  const picks = useMemo(() => slotsToPicks(slots), [slots]);

  const loadContext = useCallback(async () => {
    const res = await fetch("/api/wc-mini/context");
    if (res.ok) setCtx((await res.json()) as WcMiniContext);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const res = await fetch("/api/wc-mini/leaderboard");
      const data = (await res.json()) as {
        rows?: LeaderboardRow[];
        matchday?: number;
        submission_matchday?: number | null;
        submission_open?: boolean;
        error?: string;
      };
      if (res.ok) {
        setLeaderboard(data.rows ?? []);
        setLbGw(data.matchday ?? null);
        setLbMeta({
          submission_matchday: data.submission_matchday ?? null,
          submission_open: Boolean(data.submission_open),
        });
      }
    } finally {
      setLbLoading(false);
    }
  }, []);

  const loadExistingEntry = useCallback(async (tag: string) => {
    if (!normalizeTag(tag)) return;
    const res = await fetch(
      `/api/wc-mini/entry?entry_tag=${encodeURIComponent(tag)}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      entry: {
        picks: WcMiniPickStored[];
        captain_player_id: number;
        vice_player_id: number;
      } | null;
    };
    if (!data.entry) {
      setSlots([...EMPTY_SLOTS]);
      setCaptainId(null);
      setViceId(null);
      return;
    }
    const restored: PlayerHit[] = data.entry.picks.map((p) => ({
      fpl_id: p.fpl_id,
      web_name: p.web_name,
      team: p.team,
      team_id: p.team_id,
      position: p.position,
      base_price: p.price ?? null,
      status: null,
      form: p.form ?? null,
      total_points: null,
      points_per_game: null,
      selected_by_percent: null,
      goals_scored: p.goals ?? null,
      assists: p.assists ?? null,
      expected_goals: null,
      expected_assists: null,
    }));
    setSlots(picksToSlots(restored));
    setCaptainId(data.entry.captain_player_id);
    setViceId(data.entry.vice_player_id);
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
    if (entryTag) void loadExistingEntry(entryTag);
  }, [entryTag, loadExistingEntry, ctx?.submission_matchday]);

  const posCounts = useMemo(() => countWcMiniByPosition(picks.map(toPickInput)), [picks]);

  const validationIssues = useMemo(() => {
    const inputs = picks.map(toPickInput);
    const squad = validateWcMiniSquad(inputs);
    if (picks.length === 5 && captainId != null && viceId != null) {
      return [...squad, ...validateWcCaptaincy(inputs, captainId, viceId)];
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

  const canSubmit = Boolean(
    submissionOpen &&
    squadComplete &&
    normalizeTag(entryInput),
  );

  function assignPlayerToSlot(slotIndex: number, player: PlayerHit) {
    if (slotIndex === MINI_GK_SLOT && player.position !== "GKP") {
      showNotice(t("gkSlotOnly"));
      return;
    }
    if (slotIndex !== MINI_GK_SLOT && player.position === "GKP") {
      showNotice(t("outfieldNoGk"));
      return;
    }

    const next = [...slots];
    for (let i = 0; i < next.length; i++) {
      if (next[i]?.fpl_id === player.fpl_id) next[i] = null;
    }
    next[slotIndex] = player;

    const partial = slotsToPicks(next).map(toPickInput);
    const issues = validateWcPartialSquad(partial);
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
    setPickerSlot(slotIndex);
  }

  async function performSubmit() {
    const tag = normalizeTag(entryInput);
    if (!tag) {
      showNotice(t("invalidEntry"));
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
    try {
      localStorage.setItem(WC_MINI_TAG_KEY, tag);
    } catch {
      /* ignore */
    }

    const res = await fetch("/api/wc-mini/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_tag: tag,
        picks: picks.map((p) => p.fpl_id),
        captain_player_id: captainId,
        vice_player_id: viceId,
        matchday: ctx.submission_matchday ?? undefined,
      }),
    });

    const data = (await res.json()) as {
      error?: string;
      issues?: { message: string }[];
    };
    if (!res.ok) {
      setSubmitStatus("error");
      showNotice(data.issues?.[0]?.message ?? data.error ?? t("submitFailed"));
      return;
    }
    setSubmitStatus("ok");
    void loadLeaderboard();
  }

  function onSubmitClick() {
    if (!canSubmit) {
      if (picks.length < 5) showNotice(t("needFivePlayers"));
      else if (validationIssues[0]) showNotice(validationIssues[0].message);
      else if (!normalizeTag(entryInput)) showNotice(t("invalidEntry"));
      else showNotice(t("submissionsClosed"));
      return;
    }
    setConfirmOpen(true);
  }

  const submissionMd = ctx?.submission_matchday;
  const pickerTitle =
    pickerSlot === MINI_GK_SLOT
      ? t("pickerTitleGk")
      : t("pickerTitleOut");

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground/70">
        <p>
          {ctx?.submission_open && submissionMd != null
            ? t("statusOpen", {
                md: submissionMd,
                deadline: formatDeadline(ctx.deadline_time, locale),
              })
            : t("statusClosed", { md: ctx?.scoring_matchday ?? "—" })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t("rulesShort")}</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("pick")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            activeTab === "pick"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tabPick")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("leaderboard")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            activeTab === "leaderboard"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tabLeaderboard")}
        </button>
      </div>

      {activeTab === "pick" ? (
        <div className="flex flex-col gap-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("entryLabel")}
            </label>
            <Input
              placeholder={t("entryPlaceholder")}
              value={entryInput}
              onChange={(e) => setEntryInput(e.target.value)}
              className="max-w-xs"
            />
          </div>

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
              slotGkLabel={t("slotGk")}
              slotOutLabel={t("slotOut")}
              captainLabel={t("captain")}
              viceLabel={t("vice")}
              emptyLabel={t("tapToPick")}
              onSlotClick={onSlotClick}
              onSetCaptain={(id) => {
                setCaptainId(id);
                if (viceId === id) setViceId(null);
              }}
              onSetVice={(id) => {
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
            <p className="text-center text-xs text-muted-foreground">{t("submitLocked")}</p>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              <p>
                {t("leaderboardMd", { md: lbGw ?? "—" })}
                {!ctx?.scoring_finished ? (
                  <span className="ml-2 text-xs text-brand-accent">
                    {t("liveRefresh")}
                  </span>
                ) : null}
              </p>
              {lbMeta?.submission_open &&
              lbMeta.submission_matchday != null &&
              lbGw != null &&
              lbMeta.submission_matchday !== lbGw ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("leaderboardNextMd", { md: lbMeta.submission_matchday })}
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
                      key={row.entry_tag}
                      className="border-b border-border/60 hover:bg-card/50"
                    >
                      <td className="px-3 py-2 font-medium text-foreground">
                        {row.rank}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-foreground">
                          {row.entry_name ?? row.entry_tag}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {row.entry_tag}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-brand-accent">
                        {row.total_points}
                      </td>
                      <td className="px-3 py-2 text-foreground/70">
                        {row.captain_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
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

      <MiniPlayerPicker
        open={pickerSlot != null}
        title={pickerTitle}
        positionFilter={pickerSlot === MINI_GK_SLOT ? "GKP" : null}
        playersApi="/api/wc-mini/players"
        searchPlaceholder={t("searchPlaceholder")}
        searchingLabel={t("searching")}
        noResultsLabel={t("noResults")}
        clearSlotLabel={t("clearSlot")}
        showClear={pickerSlot != null && slots[pickerSlot!] != null}
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
