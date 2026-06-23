import { getServerSupabase } from "@/lib/supabase";
import { WC_MINI_SEASON } from "@/lib/wc-mini/season";

export interface WcMiniMatchdayContext {
  season: string;
  submission_matchday: number | null;
  submission_open: boolean;
  deadline_time: string | null;
  scoring_matchday: number;
  scoring_finished: boolean;
}

export async function getWcMiniMatchdayContext(): Promise<WcMiniMatchdayContext> {
  const supa = getServerSupabase();
  const season = WC_MINI_SEASON;

  const { data: rows } = await supa
    .from("wc_matchdays")
    .select("id,is_current,is_next,deadline_time")
    .order("id", { ascending: true });

  const mds = rows ?? [];
  const nextMd = mds.find((m) => m.is_next);
  const currentMd = mds.find((m) => m.is_current);

  const now = Date.now();
  let submissionMatchday: number | null = null;
  let submissionOpen = false;
  let deadlineTime: string | null = null;

  if (nextMd?.id != null && nextMd.deadline_time) {
    submissionMatchday = nextMd.id as number;
    deadlineTime = String(nextMd.deadline_time);
    submissionOpen = now < new Date(deadlineTime).getTime();
  }

  const scoringMatchday =
    (currentMd?.id as number | undefined) ??
    submissionMatchday ??
    (mds.filter((m) => m.id).pop()?.id as number | undefined) ??
    1;

  const scoringRow =
    currentMd ?? mds.find((m) => m.id === scoringMatchday) ?? nextMd;
  const scoringFinished = Boolean(
    scoringRow && deadlineTime && now > new Date(deadlineTime).getTime(),
  );

  return {
    season,
    submission_matchday: submissionMatchday,
    submission_open: submissionOpen,
    deadline_time: deadlineTime,
    scoring_matchday: scoringMatchday,
    scoring_finished: scoringFinished,
  };
}

export async function resolveWcSubmissionMatchday(
  requestedMd?: number,
): Promise<{ matchday: number; season: string; deadline_time: string }> {
  const ctx = await getWcMiniMatchdayContext();
  const matchday = requestedMd ?? ctx.submission_matchday;

  if (matchday == null) {
    throw new Error("No upcoming matchday is open for submissions.");
  }
  if (requestedMd != null && requestedMd !== ctx.submission_matchday) {
    throw new Error(
      `Submissions are only open for MD${ctx.submission_matchday ?? "?"}, not MD${requestedMd}.`,
    );
  }
  if (!ctx.submission_open || !ctx.deadline_time) {
    throw new Error(
      `Submissions for MD${matchday} are closed (deadline has passed).`,
    );
  }

  return {
    matchday,
    season: ctx.season,
    deadline_time: ctx.deadline_time,
  };
}
