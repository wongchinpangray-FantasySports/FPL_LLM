import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";

export interface MiniGameweekContext {
  season: string;
  /** GW open for new submissions (FPL `is_next` before deadline). */
  submission_gw: number | null;
  submission_open: boolean;
  deadline_time: string | null;
  /** GW used for live leaderboard scoring (`is_current`, else submission GW). */
  scoring_gw: number;
  scoring_finished: boolean;
}

export async function getMiniGameweekContext(): Promise<MiniGameweekContext> {
  const supa = getServerSupabase();
  const season = await getCurrentFplSeason();

  const { data: rows } = await supa
    .from("gameweeks")
    .select("id,is_current,is_next,finished,deadline_time")
    .order("id", { ascending: true });

  const gws = rows ?? [];
  const nextGw = gws.find((g) => g.is_next);
  const currentGw = gws.find((g) => g.is_current);

  const now = Date.now();
  let submissionGw: number | null = null;
  let submissionOpen = false;
  let deadlineTime: string | null = null;

  if (nextGw?.id != null && nextGw.deadline_time) {
    submissionGw = nextGw.id as number;
    deadlineTime = String(nextGw.deadline_time);
    submissionOpen = now < new Date(deadlineTime).getTime();
  }

  const scoringGw =
    (currentGw?.id as number | undefined) ??
    submissionGw ??
    (gws.filter((g) => g.finished).pop()?.id as number | undefined) ??
    1;

  const scoringRow =
    currentGw ?? gws.find((g) => g.id === scoringGw) ?? nextGw;
  const scoringFinished = Boolean(scoringRow?.finished);

  return {
    season,
    submission_gw: submissionGw,
    submission_open: submissionOpen,
    deadline_time: deadlineTime,
    scoring_gw: scoringGw,
    scoring_finished: scoringFinished,
  };
}

/** GW users may submit for; throws if submissions are closed. */
export async function resolveSubmissionGw(
  requestedGw?: number,
): Promise<{ gw: number; season: string; deadline_time: string }> {
  const ctx = await getMiniGameweekContext();
  const gw = requestedGw ?? ctx.submission_gw;

  if (gw == null) {
    throw new Error("No upcoming gameweek is open for submissions.");
  }
  if (requestedGw != null && requestedGw !== ctx.submission_gw) {
    throw new Error(
      `Submissions are only open for GW${ctx.submission_gw ?? "?"}, not GW${requestedGw}.`,
    );
  }
  if (!ctx.submission_open || !ctx.deadline_time) {
    throw new Error(
      `Submissions for GW${gw} are closed (FPL deadline has passed).`,
    );
  }

  return { gw, season: ctx.season, deadline_time: ctx.deadline_time };
}
