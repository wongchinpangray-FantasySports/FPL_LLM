import { getServerSupabase } from "@/lib/supabase";
import {
  fplGet,
  type FplEntry,
  type FplHistoryResponse,
  type FplPicksResponse,
} from "@/lib/fpl";
import type { ToolContext, ToolHandler } from "./types";
import {
  projectPlayers,
  resolveCurrentGw,
  riskAdjustedXP,
  XP_SCORING_NOTE,
  type PlayerProjection,
} from "@/lib/xp";

const CACHE_TTL_MS = 10 * 60 * 1000;

/** Bumps when `raw` shape changes so old Supabase rows are not served forever. */
const TEAM_RAW_VERSION = 4;

export interface FetchTeamOpts {
  /** bypass the 10-min Supabase cache */
  forceRefresh?: boolean;
}

export type FplSquadPick = {
  fpl_id: number;
  name: string | null;
  web_name: string | null;
  team: string | null;
  /** FPL team id — used for fixture/DGW UI (may be absent on old cached squads). */
  team_id?: number | null;
  position: string | null;
  price: number | null;
  form: number | null;
  slot: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_starter: boolean;
};

export interface CachedTeam {
  entry: Pick<
    FplEntry,
    | "id"
    | "name"
    | "player_first_name"
    | "player_last_name"
    | "summary_overall_points"
    | "summary_overall_rank"
    | "current_event"
  >;
  bank: number;
  team_value: number;
  free_transfers: number;
  current_gw: number | null;
  active_chip: string | null;
  picks: FplSquadPick[];
  /**
   * When the loaded `picks` are a **Free Hit** 15, this is the squad from
   * GW (picks_gw − 1) — the team FPL reverts to (close to "your team before
   * the Free Hit week"). Use for planner baseline.
   */
  long_team_picks: FplSquadPick[] | null;
  /** gameweek id for `long_team_picks`, if set */
  long_team_gw: number | null;
  /** short explanation for UI / tools */
  long_team_note: string | null;
  /** internal: bump when cache payload semantics change */
  team_raw_version?: number;
  /** the gameweek the picks snapshot represents (may be current_event + 1 if next-GW picks are already public) */
  picks_gw: number | null;
  /** true when we're showing last confirmed picks and the user may have a pending chip/FH saved */
  picks_may_be_stale: boolean;
  /** chips the user has already played (from /entry/{id}/history/) */
  chips_used: { name: string; event: number }[];
  fetched_at: string;
}

function isActiveFreeHit(activeChip: string | null | undefined): boolean {
  const c = normalizeChipId(activeChip);
  return c === "freehit" || c === "ff";
}

function normalizeChipId(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

/** Normalize FPL history chip names for matching (API uses `bboost`, sometimes `bench_boost`, etc.). */
function chipNameKey(name: string | null | undefined): string {
  return normalizeChipId(name).replace(/_/g, "").replace(/-/g, "");
}

/**
 * Map a `/entry/{id}/history/` chip name to a canonical bucket.
 */
function classifyUsedChip(
  name: string,
): "wildcard" | "freehit" | "bboost" | "3xc" | null {
  const id = chipNameKey(name);
  if (id === "wildcard" || id === "wc") return "wildcard";
  if (id === "freehit" || id === "ff") return "freehit";
  if (
    id === "bboost" ||
    id === "benchboost" ||
    (id.includes("bench") && id.includes("boost"))
  ) {
    return "bboost";
  }
  if (id === "3xc" || id === "triplecaptain" || id.includes("triplecaptain")) {
    return "3xc";
  }
  return null;
}

export interface ChipsRemainingState {
  wildcardsRemaining: number;
  /** 0–2: two Free Hit windows per season (GW2–19 and GW20–38). */
  freeHitsRemaining: number;
  /** 0–2: two Bench Boost windows (GW1–19 and GW20–38). */
  benchBoostsRemaining: number;
  /** 0–2: two Triple Captain windows (GW1–19 and GW20–38). */
  tripleCaptainsRemaining: number;
}

/**
 * Which half-season window a chip play belongs to (matches `bootstrap-static` `chips[]`).
 * Wildcard / Free Hit: GW2–19 vs GW20–38 (not GW1). Bench Boost / TC: GW1–19 vs GW20–38.
 */
function chipPhase(
  kind: "wildcard" | "freehit" | "bboost" | "3xc",
  event: number,
): 1 | 2 | null {
  if (!Number.isFinite(event) || event < 1 || event > 38) return null;
  if (kind === "wildcard" || kind === "freehit") {
    if (event >= 2 && event <= 19) return 1;
    if (event >= 20 && event <= 38) return 2;
    return null;
  }
  if (event >= 1 && event <= 19) return 1;
  if (event >= 20 && event <= 38) return 2;
  return null;
}

/**
 * Remaining chip plays this season. **2025/26+ rules** (from FPL `bootstrap-static`):
 * 2× Wildcard, 2× Free Hit, 2× Bench Boost, 2× Triple Captain — each split across
 * GW windows; history rows must include `event` to attribute correctly.
 */
export function computeChipsRemaining(
  chipsUsed: { name: string; event?: number }[],
): ChipsRemainingState {
  let wc1 = false;
  let wc2 = false;
  let fh1 = false;
  let fh2 = false;
  let bb1 = false;
  let bb2 = false;
  let tc1 = false;
  let tc2 = false;

  for (const c of chipsUsed) {
    const kind = classifyUsedChip(c.name);
    if (!kind) continue;
    const phase = chipPhase(kind, c.event ?? NaN);
    if (phase === null) continue;
    const slot1 = phase === 1;
    switch (kind) {
      case "wildcard":
        if (slot1) wc1 = true;
        else wc2 = true;
        break;
      case "freehit":
        if (slot1) fh1 = true;
        else fh2 = true;
        break;
      case "bboost":
        if (slot1) bb1 = true;
        else bb2 = true;
        break;
      case "3xc":
        if (slot1) tc1 = true;
        else tc2 = true;
        break;
      default:
        break;
    }
  }

  return {
    wildcardsRemaining: (wc1 ? 0 : 1) + (wc2 ? 0 : 1),
    freeHitsRemaining: (fh1 ? 0 : 1) + (fh2 ? 0 : 1),
    benchBoostsRemaining: (bb1 ? 0 : 1) + (bb2 ? 0 : 1),
    tripleCaptainsRemaining: (tc1 ? 0 : 1) + (tc2 ? 0 : 1),
  };
}

/** True when this entry’s loaded picks snapshot is a Free Hit week (from API or chip history). */
export function isFreeHitOnPicksGw(
  activeChip: string | null,
  picksGw: number | null,
  chipsUsed: { name: string; event: number }[],
): boolean {
  if (picksGw == null || picksGw <= 1) return false;
  if (isActiveFreeHit(activeChip)) return true;
  return chipsUsed.some(
    (c) => classifyUsedChip(c.name) === "freehit" && c.event === picksGw,
  );
}

/** Fifteen players for transfers / captain / chip tools: revert squad after FH when loaded, else current `picks`. */
export function picksForPlanning(team: CachedTeam): FplSquadPick[] {
  if (team.long_team_picks != null && team.long_team_picks.length > 0) {
    return team.long_team_picks;
  }
  return team.picks;
}

/** Same shape as get_my_team returns: planning/revert squad in picks when FH snapshot differs. */
export function teamPayloadForAssistant(team: CachedTeam): Record<string, unknown> {
  const picks = picksForPlanning(team);
  const base: Record<string, unknown> = { ...team, picks };
  if (team.long_team_picks?.length) {
    base.picks_free_hit_gameweek_snapshot = team.picks;
    base.transfer_planning_note =
      team.long_team_note ??
      `Field picks = GW${team.long_team_gw} revert squad for transfers/planning. picks_free_hit_gameweek_snapshot = temporary FH 15 for GW${team.picks_gw ?? "?"}.`;
  }
  return base;
}

const ELEMENT_TYPE_TO_POS: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

/** If `players_static` enrichment fails, still build a valid 15 from FPL JSON (names missing). */
function buildMinimalSquadPicks(resp: FplPicksResponse): FplSquadPick[] {
  return (resp.picks ?? []).map((p) => {
    const et = p.element_type ?? 3;
    const position = ELEMENT_TYPE_TO_POS[et] ?? "MID";
    return {
      fpl_id: p.element,
      name: null,
      web_name: `#${p.element}`,
      team: null,
      team_id: null,
      position,
      price: null,
      form: null,
      slot: p.position,
      multiplier: p.multiplier,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
      is_starter: p.position <= 11,
    };
  });
}

async function buildPicksForResponse(
  supa: ReturnType<typeof getServerSupabase>,
  picksResp: FplPicksResponse,
): Promise<FplSquadPick[]> {
  const elementIds = (picksResp.picks ?? []).map((p) => p.element);
  const players: Record<
    number,
    {
      fpl_id: number;
      name: string | null;
      web_name: string | null;
      team: string | null;
      team_id: number | null;
      position: string | null;
      base_price: number | null;
      form: number | null;
    }
  > = {};

  if (elementIds.length) {
    const { data: rows } = await supa
      .from("players_static")
      .select("fpl_id,name,web_name,team,team_id,position,base_price,form")
      .in("fpl_id", elementIds);
    for (const r of rows ?? []) {
      players[r.fpl_id as number] = r as (typeof players)[number];
    }
  }

  return (picksResp.picks ?? []).map((p) => {
    const player = players[p.element];
    return {
      fpl_id: p.element,
      name: player?.name ?? null,
      web_name: player?.web_name ?? null,
      team: player?.team ?? null,
      team_id: player?.team_id ?? null,
      position: player?.position ?? null,
      price: player?.base_price ?? null,
      form: player?.form ?? null,
      slot: p.position,
      multiplier: p.multiplier,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
      is_starter: p.position <= 11,
    };
  });
}

async function resolveEntryId(
  ctx: ToolContext,
  override: unknown,
): Promise<number> {
  const raw =
    typeof override === "number" || typeof override === "string"
      ? String(override)
      : ctx.entryId;
  if (!raw) {
    throw new Error(
      "No FPL Entry ID available. Ask the user to paste their Entry ID on the home page.",
    );
  }
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error(`Invalid FPL Entry ID: ${raw}`);
  }
  return id;
}

export async function fetchAndCacheTeam(
  entryId: number,
  opts: FetchTeamOpts = {},
): Promise<CachedTeam> {
  const supa = getServerSupabase();

  if (!opts.forceRefresh) {
    const { data: cached } = await supa
      .from("user_teams")
      .select("raw,fetched_at")
      .eq("entry_id", entryId)
      .maybeSingle();

    if (cached?.raw && cached.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        const r = cached.raw as unknown as CachedTeam;
        const merged: CachedTeam = {
          ...r,
          long_team_picks: r.long_team_picks ?? null,
          long_team_gw: r.long_team_gw ?? null,
          long_team_note: r.long_team_note ?? null,
        };
        const versionOk = (merged.team_raw_version ?? 0) >= TEAM_RAW_VERSION;
        /** Pre-v2 cache or FH without revert squad: refetch so planner can show GW(n-1) baseline. */
        const fhMissingRevert =
          merged.picks_gw != null &&
          merged.picks_gw > 1 &&
          isFreeHitOnPicksGw(
            merged.active_chip,
            merged.picks_gw,
            merged.chips_used ?? [],
          ) &&
          !merged.long_team_picks?.length;
        if (versionOk && !fhMissingRevert) {
          return merged;
        }
        // fall through to live FPL fetch
      }
    }
  }

  const [entry, history] = await Promise.all([
    fplGet<FplEntry>(`/entry/${entryId}/`),
    fplGet<FplHistoryResponse>(`/entry/${entryId}/history/`).catch(
      () => null as FplHistoryResponse | null,
    ),
  ]);
  const confirmedGw = entry.current_event;

  // Try both the current event and the next one. If the next-GW picks are
  // already public (deadline passed), prefer them — they reflect any chip
  // (Free Hit / Wildcard / Bench Boost) or transfers the manager has locked
  // in. Otherwise fall back to current_event.
  let picksResp: FplPicksResponse | null = null;
  let picksGw: number | null = null;
  if (confirmedGw) {
    const nextGw = confirmedGw + 1;
    const [nextTry, curTry] = await Promise.all([
      fplGet<FplPicksResponse>(`/entry/${entryId}/event/${nextGw}/picks/`)
        .then((r) => r)
        .catch(() => null as FplPicksResponse | null),
      fplGet<FplPicksResponse>(`/entry/${entryId}/event/${confirmedGw}/picks/`)
        .then((r) => r)
        .catch(() => null as FplPicksResponse | null),
    ]);
    if (nextTry) {
      picksResp = nextTry;
      picksGw = nextGw;
    } else if (curTry) {
      picksResp = curTry;
      picksGw = confirmedGw;
    }
  }

  const picks = picksResp
    ? await buildPicksForResponse(supa, picksResp)
    : [];

  const chipsUsed = (history?.chips ?? []).map((c) => ({
    name: c.name,
    event: c.event,
  }));

  let long_team_picks: FplSquadPick[] | null = null;
  let long_team_gw: number | null = null;
  let long_team_note: string | null = null;
  if (
    picksResp &&
    picksGw &&
    picksGw > 1 &&
    isFreeHitOnPicksGw(picksResp.active_chip, picksGw, chipsUsed)
  ) {
    try {
      const prev = await fplGet<FplPicksResponse>(
        `/entry/${entryId}/event/${picksGw - 1}/picks/`,
      );
      if (prev?.picks?.length) {
        let revertFromMinimal = false;
        try {
          long_team_picks = await buildPicksForResponse(supa, prev);
        } catch {
          long_team_picks = buildMinimalSquadPicks(prev);
          revertFromMinimal = true;
        }
        long_team_gw = picksGw - 1;
        long_team_note = revertFromMinimal
          ? `Free Hit is active on GW${picksGw}. Showing your GW${picksGw - 1} revert squad (IDs only — run DB sync if names are wrong).`
          : `Free Hit is active on GW${picksGw} picks. Your revert squad (GW${picksGw - 1} lock) is available — use it in the planner to plan the next non-FH gameweek.`;
      }
    } catch {
      /* e.g. GW1 has no previous event */
    }
  }
  // If we're still showing the confirmed GW's picks (not the next one) and
  // there's a next GW on the horizon, we can't see any pending chip/FH/WC
  // the manager may have saved. Flag it.
  const picksMayBeStale =
    picksGw != null && confirmedGw != null && picksGw === confirmedGw;

  const fetchedAt = new Date().toISOString();
  const out: CachedTeam = {
    team_raw_version: TEAM_RAW_VERSION,
    entry: {
      id: entry.id,
      name: entry.name,
      player_first_name: entry.player_first_name,
      player_last_name: entry.player_last_name,
      summary_overall_points: entry.summary_overall_points,
      summary_overall_rank: entry.summary_overall_rank,
      current_event: entry.current_event,
    },
    bank: (entry.last_deadline_bank ?? 0) / 10,
    team_value: (entry.last_deadline_value ?? 0) / 10,
    free_transfers: 1,
    current_gw: confirmedGw,
    active_chip: picksResp?.active_chip ?? null,
    picks,
    long_team_picks,
    long_team_gw,
    long_team_note,
    picks_gw: picksGw,
    picks_may_be_stale: picksMayBeStale,
    chips_used: chipsUsed,
    fetched_at: fetchedAt,
  };

  await supa.from("user_teams").upsert(
    {
      entry_id: entryId,
      entry_name: entry.name,
      player_name: `${entry.player_first_name} ${entry.player_last_name}`.trim(),
      summary_overall_points: entry.summary_overall_points,
      summary_overall_rank: entry.summary_overall_rank,
      current_gw: confirmedGw,
      bank: out.bank,
      team_value: out.team_value,
      free_transfers: out.free_transfers,
      chips_used: chipsUsed.map((c) => c.name),
      picks: picks,
      raw: out,
      fetched_at: fetchedAt,
    },
    { onConflict: "entry_id" },
  );

  return out;
}

/** Planner/dashboard loads: bypass stale rows where FH is active but `long_team_picks` never stored. */
export async function fetchTeamForUi(
  entryId: number,
  forceRefreshFromQuery = false,
): Promise<CachedTeam> {
  let team = await fetchAndCacheTeam(entryId, {
    forceRefresh: forceRefreshFromQuery,
  });
  if (forceRefreshFromQuery) return team;

  const fhMissingRevert =
    isFreeHitOnPicksGw(
      team.active_chip,
      team.picks_gw,
      team.chips_used ?? [],
    ) && !team.long_team_picks?.length;

  if (fhMissingRevert) {
    team = await fetchAndCacheTeam(entryId, { forceRefresh: true });
  }
  return team;
}

const getMyTeam: ToolHandler = {
  name: "get_my_team",
  description:
    "Fetch the user's FPL squad: 15 players, captain, vice, bank, team value, free transfers, active chip, recent chips played. Pass force_refresh=true when the user says they just made transfers or activated a chip. During a Free Hit gameweek, `picks` is the REVERT/long-term squad used for transfers and planning; `picks_free_hit_gameweek_snapshot` (when present) is the temporary FH 15 only. If picks_may_be_stale=true, the GW{picks_gw} picks haven't been published by FPL yet so the squad shown is the last confirmed team.",
  input_schema: {
    type: "object",
    properties: {
      entry_id: {
        type: "integer",
        description:
          "Optional override. If omitted, uses the Entry ID linked to this chat session.",
      },
      force_refresh: {
        type: "boolean",
        description:
          "Bypass the 10-minute Supabase cache. Use whenever the user mentions they just made changes (transfers, captain, chip).",
      },
    },
  },
  async run(input, ctx) {
    const entryId = await resolveEntryId(ctx, input.entry_id);
    const team = await fetchTeamForUi(entryId, Boolean(input.force_refresh));
    return teamPayloadForAssistant(team);
  },
};

// ---- helpers to slim down projection payloads for the LLM -----------------

function summarizeProjection(p: PlayerProjection, maxFixtures = 3) {
  return {
    fpl_id: p.fpl_id,
    web_name: p.web_name,
    team: p.team,
    position: p.position,
    price: p.price,
    ownership: p.ownership,
    form: p.form,
    availability: p.availability,
    availability_note: p.availability_note,
    set_pieces: p.set_pieces,
    rolling: {
      window_gws: p.rolling.window_gws,
      minutes: p.rolling.minutes,
      starts: p.rolling.starts,
      goals: p.rolling.goals,
      assists: p.rolling.assists,
      xg: Number(p.rolling.xg.toFixed(2)),
      xa: Number(p.rolling.xa.toFixed(2)),
      bonus: p.rolling.bonus,
      points: p.rolling.points,
      cbi: p.rolling.cbi,
      tackles: p.rolling.tackles,
      recoveries: p.rolling.recoveries,
      dc_points: p.rolling.dc_points,
      dc_games: p.rolling.dc_games,
    },
    fixtures: p.fixtures.slice(0, maxFixtures).map((f) => ({
      gw: f.gw,
      opp: f.opp_short,
      home: f.home,
      fdr: f.fdr,
      exp_minutes: f.expected_minutes,
      team_xg_for: f.team_xg_for,
      team_xg_against: f.team_xg_against,
      p_cs: f.p_clean_sheet,
      opp_history: f.opp_history,
      opp_history_mult: f.opp_history_mult,
      xG: f.xG,
      xA: f.xA,
      exp_def_actions: f.exp_defensive_actions,
      dc_threshold: f.dc_threshold,
      p_dc: f.p_dc,
      xp: f.xp_total,
      xp_breakdown: {
        appear: f.xp_appearance,
        goals: f.xp_goals,
        assists: f.xp_assists,
        cs: f.xp_cs,
        gc: f.xp_gc,
        saves: f.xp_saves,
        dc: f.xp_dc,
        bonus: f.xp_bonus,
      },
    })),
    xp_total: p.xp_total,
    xp_per_game: p.xp_per_game,
    value_per_million: p.value_per_million,
  };
}

// --- suggest_captain -------------------------------------------------------

const suggestCaptain: ToolHandler = {
  name: "suggest_captain",
  description:
    "Rank the user's starting XI for captaincy using the xP model. During a Free Hit week, uses the revert/long-term squad (not the temporary FH 15). Supports risk_mode: 'neutral' (pure xP), 'chase' (penalises high ownership — rank-climb differential captain), 'protect' (slight uplift for template picks — protect a strong rank). Returns xP, captain_ev (2× or 3× with TC chip), gap_to_second, opponent history, set-piece flags.",
  input_schema: {
    type: "object",
    properties: {
      entry_id: { type: "integer" },
      gw: {
        type: "integer",
        description: "Target gameweek. Defaults to next GW.",
      },
      risk_mode: {
        type: "string",
        enum: ["neutral", "chase", "protect"],
        description:
          "neutral=pure xP; chase=subtract ownership penalty (differential captain); protect=small uplift for template picks. Default neutral.",
      },
    },
  },
  async run(input, ctx) {
    const entryId = await resolveEntryId(ctx, input.entry_id);
    const team = await fetchTeamForUi(entryId);
    const squad = picksForPlanning(team);
    const { current, next } = await resolveCurrentGw();
    const targetGw = Number(input.gw ?? 0) || next;
    const riskMode =
      (input.risk_mode as "neutral" | "chase" | "protect") ?? "neutral";

    const starters = squad.filter((p) => p.is_starter);
    const ids = starters.map((p) => p.fpl_id);
    if (ids.length === 0) {
      return { gw: targetGw, candidates: [] };
    }

    const projections = await projectPlayers(ids, {
      currentGw: current,
      fromGw: targetGw,
      toGw: targetGw,
    });

    const tcMult = team.active_chip === "3xc" ? 3 : 2;

    const ranked = starters
      .map((s) => projections.get(s.fpl_id))
      .filter((p): p is PlayerProjection => !!p)
      .map((p) => ({
        p,
        risk_adj_xp: Number(
          riskAdjustedXP(p.xp_total, p.ownership, riskMode).toFixed(2),
        ),
      }))
      .sort((a, b) => b.risk_adj_xp - a.risk_adj_xp);

    const top3 = ranked.slice(0, 3).map((r) => ({
      ...summarizeProjection(r.p, 2),
      risk_adjusted_xp: r.risk_adj_xp,
    }));
    const all = ranked.map((r) => ({
      fpl_id: r.p.fpl_id,
      web_name: r.p.web_name,
      position: r.p.position,
      xp: r.p.xp_total,
      risk_adj_xp: r.risk_adj_xp,
      ownership: r.p.ownership,
      exp_minutes: r.p.fixtures[0]?.expected_minutes ?? 0,
      pens: r.p.set_pieces.penalties,
      opp: r.p.fixtures
        .map((f) => `${f.opp_short}${f.home ? "(H)" : "(A)"}`)
        .join(","),
    }));

    const best = ranked[0]?.p ?? null;
    const second = ranked[1]?.p ?? null;
    const safety =
      best && second ? Number((best.xp_total - second.xp_total).toFixed(2)) : 0;

    return {
      gw: targetGw,
      entry_id: entryId,
      active_chip: team.active_chip,
      risk_mode: riskMode,
      captain_multiplier: tcMult,
      scoring: XP_SCORING_NOTE,
      captain_pick: best
        ? {
            fpl_id: best.fpl_id,
            web_name: best.web_name,
            xp: best.xp_total,
            ownership: best.ownership,
            captain_ev: Number((best.xp_total * tcMult).toFixed(2)),
          }
        : null,
      vice_pick: second
        ? {
            fpl_id: second.fpl_id,
            web_name: second.web_name,
            xp: second.xp_total,
            ownership: second.ownership,
          }
        : null,
      gap_to_second: safety,
      top3,
      all,
    };
  },
};

// --- suggest_transfers -----------------------------------------------------

const suggestTransfers: ToolHandler = {
  name: "suggest_transfers",
  description:
    "Suggest the best 1 and 2 transfer moves using expected points (xP) over an N-GW horizon. Incoming candidates are **only** from the live `players_static` table (current FPL season) — never invent or assume players from memory. Uses the long-term/revert 15 when a Free Hit is active (not the temporary FH 15). Accounts for current bank, 3-per-club rule, position-matching, availability, and a -4 pt hit cost for 2nd transfer (unless free_transfers = 2). Returns ranked ideas with xP delta and a rationale-ready breakdown.",
  input_schema: {
    type: "object",
    properties: {
      entry_id: { type: "integer" },
      horizon: {
        type: "integer",
        description: "How many upcoming GWs to sum xP over (default 5, max 8).",
      },
      budget_delta: {
        type: "number",
        description:
          "Extra £m you're willing to spend beyond the outgoing player's price. Default 0.",
      },
      out_positions: {
        type: "array",
        items: { type: "string", enum: ["GKP", "DEF", "MID", "FWD"] },
        description: "Restrict outgoing player to these positions.",
      },
      min_candidate_minutes: {
        type: "integer",
        description:
          "Minimum season minutes for incoming candidates (default 270 = 3 full games).",
      },
      include_two_transfer_plan: {
        type: "boolean",
        description:
          "Also compute the best 2-transfer combo (with -4 hit if needed). Default true.",
      },
    },
  },
  async run(input, ctx) {
    const entryId = await resolveEntryId(ctx, input.entry_id);
    const team = await fetchTeamForUi(entryId);
    const squad = picksForPlanning(team);
    const { current, next } = await resolveCurrentGw();
    const horizon = Math.min(Math.max(Number(input.horizon ?? 5) || 5, 1), 8);
    const budgetDelta = Number(input.budget_delta ?? 0) || 0;
    const bank = team.bank;
    const freeTransfers = team.free_transfers ?? 1;
    const outPositions = Array.isArray(input.out_positions)
      ? (input.out_positions as string[])
      : null;
    const minMinutes = Number(input.min_candidate_minutes ?? 270) || 270;
    const includeTwo =
      input.include_two_transfer_plan !== false;

    const ownedIds = squad.map((p) => p.fpl_id);

    // Pull a candidate pool: all players with enough minutes & available.
    const supa = getServerSupabase();
    const { data: candidateRows } = await supa
      .from("players_static")
      .select("fpl_id,position,base_price,team_id,minutes,status,chance_of_playing")
      .gte("minutes", minMinutes)
      .lte("base_price", 15.0);
    const candidateIds = (candidateRows ?? [])
      .filter((r) => {
        const status = r.status ?? "a";
        if (status === "u" || status === "n" || status === "s") return false;
        const cop = r.chance_of_playing;
        if (typeof cop === "number" && cop < 75) return false;
        return true;
      })
      .map((r) => r.fpl_id as number);

    // Project everyone we care about (owned + candidates) in one batch.
    const allIds = Array.from(new Set([...ownedIds, ...candidateIds]));
    const projections = await projectPlayers(allIds, {
      currentGw: current,
      fromGw: next,
      toGw: next + horizon - 1,
    });

    const owned = squad
      .map((p) => projections.get(p.fpl_id))
      .filter((p): p is PlayerProjection => !!p);

    // Count current club usage for 3-per-team rule.
    const clubCount = new Map<number, number>();
    for (const p of owned) {
      if (p.team_id != null) {
        clubCount.set(p.team_id, (clubCount.get(p.team_id) ?? 0) + 1);
      }
    }

    const ownedIdSet = new Set(ownedIds);

    interface SingleMove {
      out: PlayerProjection;
      in: PlayerProjection;
      delta: number;
      spend: number;
      budget_ok: boolean;
      club_ok: boolean;
    }

    const singleMoves: SingleMove[] = [];

    for (const outP of owned) {
      if (outPositions && outP.position && !outPositions.includes(outP.position))
        continue;
      const outPrice = outP.price ?? 0;
      const budget = outPrice + bank + budgetDelta;

      for (const cand of projections.values()) {
        if (ownedIdSet.has(cand.fpl_id)) continue;
        if (cand.position !== outP.position) continue;
        if ((cand.price ?? Infinity) > budget) continue;

        // 3-per-club check (counting out-player leaving, in-player arriving)
        let club_ok = true;
        if (cand.team_id != null) {
          const after =
            (clubCount.get(cand.team_id) ?? 0) +
            1 -
            (outP.team_id === cand.team_id ? 1 : 0);
          if (after > 3) club_ok = false;
        }

        const delta = cand.xp_total - outP.xp_total;
        if (delta <= 0) continue;

        singleMoves.push({
          out: outP,
          in: cand,
          delta: Number(delta.toFixed(2)),
          spend: Number(((cand.price ?? 0) - outPrice).toFixed(1)),
          budget_ok: (cand.price ?? 0) - outPrice <= bank + budgetDelta,
          club_ok,
        });
      }
    }

    singleMoves.sort((a, b) => b.delta - a.delta);

    const feasibleSingles = singleMoves.filter((m) => m.budget_ok && m.club_ok);
    const bestSingle = feasibleSingles[0] ?? null;

    // --- best 2-transfer combo: pick top-K candidates per position, try
    // pairs that are feasible together (combined spend ≤ bank + budget_delta,
    // 3-per-club ok). Hit cost = -4 if freeTransfers < 2.
    let bestPair: {
      moves: SingleMove[];
      total_delta_raw: number;
      hit_cost: number;
      total_delta_net: number;
    } | null = null;

    if (includeTwo) {
      const TOP_K = 30;
      const topPerOut = new Map<number, SingleMove[]>();
      for (const m of feasibleSingles) {
        const key = m.out.fpl_id;
        if (!topPerOut.has(key)) topPerOut.set(key, []);
        const arr = topPerOut.get(key)!;
        if (arr.length < TOP_K) arr.push(m);
      }

      const outList = Array.from(topPerOut.keys());
      for (let i = 0; i < outList.length; i++) {
        for (let j = i + 1; j < outList.length; j++) {
          const aMoves = topPerOut.get(outList[i]) ?? [];
          const bMoves = topPerOut.get(outList[j]) ?? [];
          for (const m1 of aMoves) {
            for (const m2 of bMoves) {
              if (m1.in.fpl_id === m2.in.fpl_id) continue;
              const spend = m1.spend + m2.spend;
              if (spend > bank + budgetDelta) continue;
              // club rule across the pair
              const clubDelta = new Map<number, number>();
              if (m1.out.team_id != null)
                clubDelta.set(
                  m1.out.team_id,
                  (clubDelta.get(m1.out.team_id) ?? 0) - 1,
                );
              if (m2.out.team_id != null)
                clubDelta.set(
                  m2.out.team_id,
                  (clubDelta.get(m2.out.team_id) ?? 0) - 1,
                );
              if (m1.in.team_id != null)
                clubDelta.set(
                  m1.in.team_id,
                  (clubDelta.get(m1.in.team_id) ?? 0) + 1,
                );
              if (m2.in.team_id != null)
                clubDelta.set(
                  m2.in.team_id,
                  (clubDelta.get(m2.in.team_id) ?? 0) + 1,
                );
              let ok = true;
              for (const [tid, d] of clubDelta.entries()) {
                const after = (clubCount.get(tid) ?? 0) + d;
                if (after > 3) {
                  ok = false;
                  break;
                }
              }
              if (!ok) continue;

              const rawDelta = m1.delta + m2.delta;
              const hit = freeTransfers >= 2 ? 0 : 4;
              const net = rawDelta - hit;
              if (!bestPair || net > bestPair.total_delta_net) {
                bestPair = {
                  moves: [m1, m2],
                  total_delta_raw: Number(rawDelta.toFixed(2)),
                  hit_cost: hit,
                  total_delta_net: Number(net.toFixed(2)),
                };
              }
            }
          }
        }
      }
    }

    const topIdeas = feasibleSingles.slice(0, 5).map((m) => ({
      out: summarizeProjection(m.out, 2),
      in: summarizeProjection(m.in, 2),
      xp_delta: m.delta,
      spend_m: m.spend,
    }));

    return {
      entry_id: entryId,
      horizon,
      current_gw: current,
      target_gws: `${next}..${next + horizon - 1}`,
      bank,
      free_transfers: freeTransfers,
      scoring: XP_SCORING_NOTE,
      best_single: bestSingle
        ? {
            out: summarizeProjection(bestSingle.out, 2),
            in: summarizeProjection(bestSingle.in, 2),
            xp_delta: bestSingle.delta,
            spend_m: bestSingle.spend,
          }
        : null,
      best_pair: bestPair
        ? {
            moves: bestPair.moves.map((m) => ({
              out: summarizeProjection(m.out, 1),
              in: summarizeProjection(m.in, 1),
              xp_delta: m.delta,
              spend_m: m.spend,
            })),
            hit_cost: bestPair.hit_cost,
            raw_delta: bestPair.total_delta_raw,
            net_delta: bestPair.total_delta_net,
            verdict:
              bestPair.total_delta_net > (bestSingle?.delta ?? 0)
                ? "2-transfer plan beats 1 transfer (net of hit)"
                : "1 transfer is preferable this week",
          }
        : null,
      top_ideas: topIdeas,
    };
  },
};

// --- chip strategy ---------------------------------------------------------

const chipStrategy: ToolHandler = {
  name: "chip_strategy",
  description:
    "Plan when to use each remaining chip (Triple Captain, Bench Boost, Wildcard, Free Hit) by summing starting-XI xP across the next 8 GWs. Returns per-GW projected points, best single-GW xP (TC candidate), best bench xP (BB candidate), and flag if a wildcard could add ≥ 15 xP.",
  input_schema: {
    type: "object",
    properties: {
      entry_id: { type: "integer" },
      horizon: {
        type: "integer",
        description: "How many upcoming GWs to model (default 8, max 10).",
      },
    },
  },
  async run(input, ctx) {
    const entryId = await resolveEntryId(ctx, input.entry_id);
    const team = await fetchTeamForUi(entryId);
    const squad = picksForPlanning(team);
    const { current, next } = await resolveCurrentGw();
    const horizon = Math.min(Math.max(Number(input.horizon ?? 8) || 8, 1), 10);
    const ids = squad.map((p) => p.fpl_id);

    const projections = await projectPlayers(ids, {
      currentGw: current,
      fromGw: next,
      toGw: next + horizon - 1,
    });

    // per-GW: best XI from the 15, plus bench total
    const perGw: Array<{
      gw: number;
      xi_xp: number;
      bench_xp: number;
      best_captain: { web_name: string | null; xp: number } | null;
    }> = [];

    for (let g = next; g < next + horizon; g++) {
      const scored = squad.map((p) => {
        const proj = projections.get(p.fpl_id);
        const f = proj?.fixtures.find((x) => x.gw === g);
        return {
          fpl_id: p.fpl_id,
          web_name: p.web_name,
          position: p.position,
          xp: f?.xp_total ?? 0,
        };
      });

      // naive best XI: keep formation constraints (1 GKP, 3-5 DEF, 2-5 MID, 1-3 FWD, sum=11)
      const gkps = scored
        .filter((s) => s.position === "GKP")
        .sort((a, b) => b.xp - a.xp);
      const defs = scored
        .filter((s) => s.position === "DEF")
        .sort((a, b) => b.xp - a.xp);
      const mids = scored
        .filter((s) => s.position === "MID")
        .sort((a, b) => b.xp - a.xp);
      const fwds = scored
        .filter((s) => s.position === "FWD")
        .sort((a, b) => b.xp - a.xp);

      const xi: typeof scored = [];
      if (gkps[0]) xi.push(gkps[0]);
      xi.push(...defs.slice(0, 3));
      xi.push(...mids.slice(0, 2));
      xi.push(...fwds.slice(0, 1));
      // fill remaining 4 slots greedily from best outfield leftovers
      const outfieldRest = [
        ...defs.slice(3),
        ...mids.slice(2),
        ...fwds.slice(1),
      ].sort((a, b) => b.xp - a.xp);
      for (const c of outfieldRest) {
        if (xi.length >= 11) break;
        // position caps: max 5 DEF, 5 MID, 3 FWD
        const n = (pos: string) =>
          xi.filter((x) => x.position === pos).length;
        if (c.position === "DEF" && n("DEF") >= 5) continue;
        if (c.position === "MID" && n("MID") >= 5) continue;
        if (c.position === "FWD" && n("FWD") >= 3) continue;
        xi.push(c);
      }

      const xiTotal = xi.reduce((s, p) => s + p.xp, 0);
      const allTotal = scored.reduce((s, p) => s + p.xp, 0);
      const benchTotal = allTotal - xiTotal;
      const bestCap = xi.length
        ? xi.slice().sort((a, b) => b.xp - a.xp)[0]
        : null;

      perGw.push({
        gw: g,
        xi_xp: Number(xiTotal.toFixed(2)),
        bench_xp: Number(benchTotal.toFixed(2)),
        best_captain: bestCap
          ? { web_name: bestCap.web_name, xp: Number(bestCap.xp.toFixed(2)) }
          : null,
      });
    }

    // Triple Captain: max (best_captain.xp) — TC gives +captain_xp extra
    const tcPick = perGw
      .slice()
      .sort(
        (a, b) => (b.best_captain?.xp ?? 0) - (a.best_captain?.xp ?? 0),
      )[0];
    // Bench Boost: max bench_xp
    const bbPick = perGw.slice().sort((a, b) => b.bench_xp - a.bench_xp)[0];
    // Wildcard: estimate how much you'd gain by replacing the 3 worst XI
    // performers averaged across horizon with top-xp replacements. Approx:
    // count starters projecting < 2.5 xP per game avg.
    const weakCount = squad
      .filter((p) => p.is_starter)
      .filter((p) => {
        const proj = projections.get(p.fpl_id);
        return proj && proj.xp_per_game < 2.5;
      }).length;

    return {
      entry_id: entryId,
      current_gw: current,
      horizon,
      active_chip: team.active_chip,
      per_gw: perGw,
      recommendations: {
        triple_captain: tcPick
          ? {
              gw: tcPick.gw,
              candidate: tcPick.best_captain?.web_name,
              extra_xp: tcPick.best_captain
                ? Number(tcPick.best_captain.xp.toFixed(2))
                : 0,
              note:
                (tcPick.best_captain?.xp ?? 0) >= 7
                  ? "Strong window — elite xP for captain."
                  : "Marginal — consider holding for a better fixture.",
            }
          : null,
        bench_boost: bbPick
          ? {
              gw: bbPick.gw,
              bench_xp: bbPick.bench_xp,
              note:
                bbPick.bench_xp >= 12
                  ? "Solid bench projection — good BB candidate."
                  : "Bench is light; hold BB for a double-GW if possible.",
            }
          : null,
        wildcard: {
          weak_starters: weakCount,
          note:
            weakCount >= 4
              ? "Four+ starters projecting <2.5 xP/gw — wildcard worth serious consideration."
              : weakCount >= 2
                ? "2-3 weak starters — targeted transfers probably suffice."
                : "Team looks solid; no wildcard urgency.",
        },
      },
    };
  },
};

export const teamTools: ToolHandler[] = [
  getMyTeam,
  suggestCaptain,
  suggestTransfers,
  chipStrategy,
];
