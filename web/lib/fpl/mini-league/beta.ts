import { randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/auth/admin";
import { fplGet } from "@/lib/fpl";
import {
  canAccessPremiumFeature,
  isInsightsPremiumEnforced,
} from "@/lib/fpl/insights/access";
import { getServerSupabase } from "@/lib/supabase";
import { resolveCurrentGw } from "@/lib/xp";
import {
  MINI_LEAGUE_BETA_DURATION_EVENTS,
  clampBetaDuration,
  isTrialExpired,
  remainingTrialEvents,
  trialEndEvent,
} from "@/lib/fpl/mini-league/beta-window";
import type {
  MiniLeagueAccessReason,
  MiniLeagueBetaInviteRow,
  MiniLeagueBetaInviteStatus,
  MiniLeagueBetaRole,
  MiniLeagueBetaView,
  MiniLeagueFeedbackRow,
} from "@/lib/fpl/mini-league/beta-types";

export type {
  MiniLeagueAccessReason,
  MiniLeagueBetaInviteRow,
  MiniLeagueBetaInviteStatus,
  MiniLeagueBetaRole,
  MiniLeagueBetaView,
  MiniLeagueFeedbackRow,
} from "@/lib/fpl/mini-league/beta-types";

export {
  MINI_LEAGUE_BETA_DURATION_EVENTS,
  MINI_LEAGUE_BETA_RECOMMENDED_TESTERS,
  MINI_LEAGUE_BETA_TESTER_MAX,
  MINI_LEAGUE_BETA_TESTER_MIN,
  clampBetaDuration,
  remainingTrialEvents,
  trialEndEvent,
} from "@/lib/fpl/mini-league/beta-window";

const INVITE_TABLE = "mini_league_beta_invites";
const FEEDBACK_TABLE = "mini_league_feedback";

type InviteDbRow = {
  id: string;
  email: string | null;
  fpl_entry_id: number | null;
  token: string;
  invited_by: string | null;
  start_event: number | null;
  end_event: number | null;
  duration_events: number | null;
  claimed_by: string | null;
  claimed_at: string | null;
  status: MiniLeagueBetaInviteStatus;
  notes: string | null;
  created_at: string;
};

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

export function isMiniLeagueOpen(): boolean {
  return process.env.MINI_LEAGUE_OPEN === "true";
}

export function getMiniLeagueBetaAllowlist(): string[] {
  return (process.env.MINI_LEAGUE_BETA_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseInviteEmails(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,;]+/)) {
    const email = normalizeInviteEmail(part);
    if (email.includes("@") && email.includes(".")) seen.add(email);
  }
  return [...seen];
}

export function invitePath(token: string): string {
  return `/fpl/mini-league?invite=${encodeURIComponent(token)}`;
}

function newInviteToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function currentMiniLeagueGw(): Promise<number> {
  try {
    const gw = await resolveCurrentGw();
    return Number(gw.current) || Number(gw.next) || 1;
  } catch {
    try {
      const boot = await fplGet<{
        events?: Array<{ id?: number; is_current?: boolean; is_next?: boolean }>;
      }>("/bootstrap-static/");
      const events = boot.events ?? [];
      const cur = events.find((e) => e.is_current);
      const nxt = events.find((e) => e.is_next);
      return Number(cur?.id) || Number(nxt?.id) || 1;
    } catch {
      return 1;
    }
  }
}

function effectiveInviteStatus(
  row: Pick<InviteDbRow, "status" | "end_event">,
  currentGw: number,
): MiniLeagueBetaInviteStatus {
  if (row.status === "revoked") return "revoked";
  if (row.status === "pending") return "pending";
  if (isTrialExpired(currentGw, row.end_event)) return "expired";
  return row.status;
}

function mapInvite(
  row: InviteDbRow,
  currentGw: number,
  claimedName: string | null,
): MiniLeagueBetaInviteRow {
  const durationEvents = clampBetaDuration(row.duration_events);
  const effectiveStatus = effectiveInviteStatus(row, currentGw);
  return {
    id: row.id,
    email: row.email,
    fplEntryId: row.fpl_entry_id,
    token: row.token,
    path: invitePath(row.token),
    invitedBy: row.invited_by,
    startEvent: row.start_event,
    endEvent: row.end_event,
    durationEvents,
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at,
    claimedName,
    status: row.status,
    effectiveStatus,
    remainingGws:
      effectiveStatus === "active" || effectiveStatus === "expired"
        ? remainingTrialEvents(currentGw, row.end_event)
        : null,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function emptyAccess(
  reason: MiniLeagueAccessReason,
  currentGw: number,
  tableMissing = false,
): MiniLeagueBetaView {
  return {
    allowed: false,
    reason,
    role: null,
    startEvent: null,
    endEvent: null,
    currentGw,
    remainingGws: null,
    durationEvents: MINI_LEAGUE_BETA_DURATION_EVENTS,
    tableMissing,
  };
}

function allowedView(
  role: MiniLeagueBetaRole,
  currentGw: number,
  extra?: Partial<MiniLeagueBetaView>,
): MiniLeagueBetaView {
  return {
    allowed: true,
    reason: "ok",
    role,
    startEvent: extra?.startEvent ?? null,
    endEvent: extra?.endEvent ?? null,
    currentGw,
    remainingGws: extra?.remainingGws ?? null,
    durationEvents: extra?.durationEvents ?? MINI_LEAGUE_BETA_DURATION_EVENTS,
    tableMissing: extra?.tableMissing ?? false,
  };
}

async function activateInvite(
  row: InviteDbRow,
  userId: string,
  currentGw: number,
): Promise<InviteDbRow | null> {
  const duration = clampBetaDuration(row.duration_events);
  const startEvent = row.start_event ?? currentGw;
  const endEvent = row.end_event ?? trialEndEvent(startEvent, duration);
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from(INVITE_TABLE)
      .update({
        status: "active",
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
        start_event: startEvent,
        end_event: endEvent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select(
        "id,email,fpl_entry_id,token,invited_by,start_event,end_event,duration_events,claimed_by,claimed_at,status,notes,created_at",
      )
      .maybeSingle();
    if (error || !data) return null;
    return data as InviteDbRow;
  } catch {
    return null;
  }
}

async function findInviteForUser(
  user: { id: string; email?: string | null },
  currentGw: number,
): Promise<{ row: InviteDbRow | null; tableMissing: boolean }> {
  try {
    const supa = getServerSupabase();
    const email = user.email ? normalizeInviteEmail(user.email) : "";

    const claimed = await supa
      .from(INVITE_TABLE)
      .select(
        "id,email,fpl_entry_id,token,invited_by,start_event,end_event,duration_events,claimed_by,claimed_at,status,notes,created_at",
      )
      .eq("claimed_by", user.id)
      .neq("status", "revoked")
      .order("created_at", { ascending: false })
      .limit(8);
    if (claimed.error) {
      return { row: null, tableMissing: isMissingRelation(claimed.error) };
    }
    const claimedRows = (claimed.data ?? []) as InviteDbRow[];
    const live = claimedRows.find(
      (row) => effectiveInviteStatus(row, currentGw) === "active",
    );
    if (live) return { row: live, tableMissing: false };
    const expired = claimedRows.find(
      (row) => effectiveInviteStatus(row, currentGw) === "expired",
    );
    if (expired) return { row: expired, tableMissing: false };

    if (email) {
      const pending = await supa
        .from(INVITE_TABLE)
        .select(
          "id,email,fpl_entry_id,token,invited_by,start_event,end_event,duration_events,claimed_by,claimed_at,status,notes,created_at",
        )
        .eq("email", email)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pending.error) {
        return { row: null, tableMissing: isMissingRelation(pending.error) };
      }
      if (pending.data) {
        const activated = await activateInvite(
          pending.data as InviteDbRow,
          user.id,
          currentGw,
        );
        if (activated) return { row: activated, tableMissing: false };
      }
    }

    return { row: claimedRows[0] ?? null, tableMissing: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return {
      row: null,
      tableMissing: /does not exist|could not find the table|schema cache/i.test(
        message,
      ),
    };
  }
}

export async function resolveMiniLeagueAccess(
  user: { id?: string | null; email?: string | null } | null | undefined,
): Promise<MiniLeagueBetaView> {
  const currentGw = await currentMiniLeagueGw();

  if (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_LOCAL_DASHBOARD_PREVIEW === "1"
  ) {
    return allowedView("preview", currentGw);
  }

  if (isMiniLeagueOpen()) {
    const openOk = await canAccessPremiumFeature(user?.id);
    if (openOk) return allowedView("open", currentGw);
    return emptyAccess(
      isInsightsPremiumEnforced() ? "premium_required" : "unauthenticated",
      currentGw,
    );
  }

  if (!user?.id) return emptyAccess("unauthenticated", currentGw);

  if (isAdminEmail(user.email)) {
    return allowedView("admin", currentGw);
  }

  const allowlist = getMiniLeagueBetaAllowlist();
  const email = user.email ? normalizeInviteEmail(user.email) : "";
  if (email && allowlist.includes(email)) {
    return allowedView("allowlist", currentGw);
  }

  if (isInsightsPremiumEnforced()) {
    const premium = await canAccessPremiumFeature(user.id);
    if (premium) return allowedView("premium", currentGw);
  }

  const found = await findInviteForUser(
    { id: user.id, email: user.email },
    currentGw,
  );
  if (found.tableMissing) {
    return emptyAccess("beta_required", currentGw, true);
  }
  if (!found.row) return emptyAccess("beta_required", currentGw);

  const status = effectiveInviteStatus(found.row, currentGw);
  if (status === "revoked") return emptyAccess("revoked", currentGw);
  if (status === "pending") return emptyAccess("beta_required", currentGw);
  if (status === "expired") {
    return {
      ...emptyAccess("expired", currentGw),
      startEvent: found.row.start_event,
      endEvent: found.row.end_event,
      remainingGws: 0,
      durationEvents: clampBetaDuration(found.row.duration_events),
    };
  }

  return allowedView("tester", currentGw, {
    startEvent: found.row.start_event,
    endEvent: found.row.end_event,
    remainingGws: remainingTrialEvents(currentGw, found.row.end_event),
    durationEvents: clampBetaDuration(found.row.duration_events),
  });
}

export type ClaimInviteResult =
  | { ok: true; already: boolean }
  | { ok: false; error: "invalid" | "revoked" | "taken" | "missing_table" };

export async function claimMiniLeagueInvite(
  user: User,
  token: string,
): Promise<ClaimInviteResult> {
  const raw = token.trim();
  if (!raw) return { ok: false, error: "invalid" };
  const currentGw = await currentMiniLeagueGw();
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from(INVITE_TABLE)
      .select(
        "id,email,fpl_entry_id,token,invited_by,start_event,end_event,duration_events,claimed_by,claimed_at,status,notes,created_at",
      )
      .eq("token", raw)
      .maybeSingle();
    if (error) {
      return {
        ok: false,
        error: isMissingRelation(error) ? "missing_table" : "invalid",
      };
    }
    if (!data) return { ok: false, error: "invalid" };
    const row = data as InviteDbRow;
    if (row.status === "revoked") return { ok: false, error: "revoked" };
    if (row.claimed_by && row.claimed_by !== user.id) {
      return { ok: false, error: "taken" };
    }
    if (row.claimed_by === user.id && row.status === "active") {
      return { ok: true, already: true };
    }
    const activated = await activateInvite(row, user.id, currentGw);
    if (!activated) {
      if (row.status === "active" && row.claimed_by === user.id) {
        return { ok: true, already: true };
      }
      return { ok: false, error: "taken" };
    }
    return { ok: true, already: false };
  } catch {
    return { ok: false, error: "missing_table" };
  }
}

export async function listMiniLeagueInvites(): Promise<{
  invites: MiniLeagueBetaInviteRow[];
  tableMissing: boolean;
  currentGw: number;
}> {
  const currentGw = await currentMiniLeagueGw();
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from(INVITE_TABLE)
      .select(
        "id,email,fpl_entry_id,token,invited_by,start_event,end_event,duration_events,claimed_by,claimed_at,status,notes,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      return {
        invites: [],
        tableMissing: isMissingRelation(error),
        currentGw,
      };
    }
    const rows = (data ?? []) as InviteDbRow[];
    const claimedIds = [
      ...new Set(rows.map((r) => r.claimed_by).filter((id): id is string => Boolean(id))),
    ];
    const names = new Map<string, string>();
    if (claimedIds.length) {
      const profiles = await supa
        .from("profiles")
        .select("id,display_name")
        .in("id", claimedIds);
      for (const p of profiles.data ?? []) {
        const row = p as { id: string; display_name: string | null };
        if (row.display_name) names.set(row.id, row.display_name);
      }
    }
    return {
      invites: rows.map((row) =>
        mapInvite(row, currentGw, row.claimed_by ? names.get(row.claimed_by) ?? null : null),
      ),
      tableMissing: false,
      currentGw,
    };
  } catch {
    return { invites: [], tableMissing: true, currentGw };
  }
}

export async function createMiniLeagueInvites(input: {
  emails: string[];
  extraLinks?: number;
  durationEvents?: number;
  startMode?: "on_claim" | "now";
  notes?: string;
  invitedBy?: string | null;
}): Promise<{ invites: MiniLeagueBetaInviteRow[]; tableMissing: boolean; error?: string }> {
  const emails = [...new Set(input.emails.map(normalizeInviteEmail).filter((e) => e.includes("@")))];
  const extra = Math.min(20, Math.max(0, Math.round(input.extraLinks ?? 0)));
  const durationEvents = clampBetaDuration(input.durationEvents);
  const currentGw = await currentMiniLeagueGw();
  const startNow = input.startMode === "now";
  const startEvent = startNow ? currentGw : null;
  const endEvent = startNow ? trialEndEvent(currentGw, durationEvents) : null;
  const notes = input.notes?.trim() || null;

  const rows: Array<Record<string, unknown>> = [];
  for (const email of emails) {
    rows.push({
      email,
      token: newInviteToken(),
      invited_by: input.invitedBy ?? null,
      duration_events: durationEvents,
      start_event: startEvent,
      end_event: endEvent,
      status: "pending",
      notes,
    });
  }
  for (let i = 0; i < extra; i += 1) {
    rows.push({
      email: null,
      token: newInviteToken(),
      invited_by: input.invitedBy ?? null,
      duration_events: durationEvents,
      start_event: startEvent,
      end_event: endEvent,
      status: "pending",
      notes,
    });
  }
  if (!rows.length) {
    return { invites: [], tableMissing: false, error: "empty" };
  }

  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from(INVITE_TABLE)
      .insert(rows)
      .select(
        "id,email,fpl_entry_id,token,invited_by,start_event,end_event,duration_events,claimed_by,claimed_at,status,notes,created_at",
      );
    if (error) {
      return {
        invites: [],
        tableMissing: isMissingRelation(error),
        error: isMissingRelation(error) ? "missing_table" : error.message,
      };
    }
    return {
      invites: ((data ?? []) as InviteDbRow[]).map((row) => mapInvite(row, currentGw, null)),
      tableMissing: false,
    };
  } catch (err) {
    return {
      invites: [],
      tableMissing: true,
      error: err instanceof Error ? err.message : "missing_table",
    };
  }
}

export async function updateMiniLeagueInvite(
  id: string,
  patch: { action: "revoke" } | { action: "extend"; extraEvents?: number },
): Promise<{ invite: MiniLeagueBetaInviteRow | null; error?: string }> {
  const currentGw = await currentMiniLeagueGw();
  try {
    const supa = getServerSupabase();
    if (patch.action === "revoke") {
      const { data, error } = await supa
        .from(INVITE_TABLE)
        .update({
          status: "revoked",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(
          "id,email,fpl_entry_id,token,invited_by,start_event,end_event,duration_events,claimed_by,claimed_at,status,notes,created_at",
        )
        .maybeSingle();
      if (error || !data) return { invite: null, error: error?.message ?? "not_found" };
      return { invite: mapInvite(data as InviteDbRow, currentGw, null) };
    }

    const extra = clampBetaDuration(patch.extraEvents ?? MINI_LEAGUE_BETA_DURATION_EVENTS);
    const existing = await supa
      .from(INVITE_TABLE)
      .select(
        "id,email,fpl_entry_id,token,invited_by,start_event,end_event,duration_events,claimed_by,claimed_at,status,notes,created_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (existing.error || !existing.data) {
      return { invite: null, error: existing.error?.message ?? "not_found" };
    }
    const row = existing.data as InviteDbRow;
    const baseEnd = row.end_event ?? trialEndEvent(row.start_event ?? currentGw, row.duration_events ?? extra);
    const nextEnd = Math.max(baseEnd, currentGw) + extra;
    const { data, error } = await supa
      .from(INVITE_TABLE)
      .update({
        end_event: nextEnd,
        status: row.status === "revoked" ? "revoked" : row.claimed_by ? "active" : "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "id,email,fpl_entry_id,token,invited_by,start_event,end_event,duration_events,claimed_by,claimed_at,status,notes,created_at",
      )
      .maybeSingle();
    if (error || !data) return { invite: null, error: error?.message ?? "not_found" };
    return { invite: mapInvite(data as InviteDbRow, currentGw, null) };
  } catch (err) {
    return { invite: null, error: err instanceof Error ? err.message : "failed" };
  }
}

export async function canSubmitMiniLeagueFeedback(user: {
  id: string;
  email?: string | null;
}): Promise<boolean> {
  const access = await resolveMiniLeagueAccess(user);
  if (access.allowed) return true;
  return access.reason === "expired";
}

export async function submitMiniLeagueFeedback(input: {
  user: User;
  body: string;
  toolId?: string | null;
  rating?: number | null;
  fplEntryId?: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = input.body.trim();
  if (body.length < 8) return { ok: false, error: "short" };
  if (body.length > 4000) return { ok: false, error: "long" };
  const allowed = await canSubmitMiniLeagueFeedback({
    id: input.user.id,
    email: input.user.email,
  });
  if (!allowed) return { ok: false, error: "forbidden" };

  const rating =
    input.rating == null || input.rating === 0
      ? null
      : Math.min(5, Math.max(1, Math.round(input.rating)));
  const toolId = input.toolId?.trim() || null;
  const currentGw = await currentMiniLeagueGw();

  try {
    const supa = getServerSupabase();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = await supa
      .from(FEEDBACK_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("user_id", input.user.id)
      .gte("created_at", since);
    if ((recent.count ?? 0) >= 20) return { ok: false, error: "rate_limited" };

    const { error } = await supa.from(FEEDBACK_TABLE).insert({
      user_id: input.user.id,
      email: input.user.email ? normalizeInviteEmail(input.user.email) : null,
      fpl_entry_id: input.fplEntryId ?? null,
      gameweek: currentGw,
      tool_id: toolId,
      rating,
      body,
    });
    if (error) {
      return {
        ok: false,
        error: isMissingRelation(error) ? "missing_table" : error.message,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "failed" };
  }
}

export async function listMiniLeagueFeedback(): Promise<{
  rows: MiniLeagueFeedbackRow[];
  tableMissing: boolean;
}> {
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from(FEEDBACK_TABLE)
      .select("id,user_id,email,fpl_entry_id,gameweek,tool_id,rating,body,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      return { rows: [], tableMissing: isMissingRelation(error) };
    }
    return {
      tableMissing: false,
      rows: ((data ?? []) as Array<{
        id: string;
        user_id: string | null;
        email: string | null;
        fpl_entry_id: number | null;
        gameweek: number | null;
        tool_id: string | null;
        rating: number | null;
        body: string;
        created_at: string;
      }>).map((row) => ({
        id: row.id,
        userId: row.user_id,
        email: row.email,
        fplEntryId: row.fpl_entry_id,
        gameweek: row.gameweek,
        toolId: row.tool_id,
        rating: row.rating,
        body: row.body,
        createdAt: row.created_at,
      })),
    };
  } catch {
    return { rows: [], tableMissing: true };
  }
}
