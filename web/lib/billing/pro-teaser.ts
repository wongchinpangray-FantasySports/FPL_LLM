/**
 * Leak-safe PRO teaser: Entry snapshot + 3 problems. Never includes
 * IN→OUT, XI, C/VC, climb plan, or the evidence appendix.
 */
import {
  computeChipsRemaining,
  fetchTeamForUi,
  picksForPlanning,
  type FplSquadPick,
} from "@/lib/tools/team";
import { fplGet, type FplClassicLeague } from "@/lib/fpl";
import { validateFplEntryExists } from "@/lib/auth/fpl-access";
import { getMiniGameweekContext } from "@/lib/mini/gameweek";
import { getServerSupabase } from "@/lib/supabase";

export type TeaserLocale = "zh" | "en";

export type TeaserProblem = {
  kind: "overall" | "league" | "transfer";
  title: string;
  body: string;
};

export type TeaserLockedBlock = {
  id: "ft" | "xi" | "league" | "evidence" | "revise";
  label: string;
};

export type ProTeaser = {
  entryId: number;
  teamName: string;
  managerName: string;
  snapshot: {
    points: number | null;
    overallRank: number | null;
    overallRankLabel: string;
    bankLabel: string;
    freeTransfers: number;
    chipsLabel: string;
    nextGw: number | null;
    deadlineIso: string | null;
    deadlineLabel: string;
  };
  league: {
    name: string;
    rank: number | null;
    gap: number | null;
  } | null;
  problems: TeaserProblem[];
  redactedPlan: string;
  locked: TeaserLockedBlock[];
};

export type TeaserSquadFlag = {
  web_name: string;
  position: string | null;
  team: string | null;
  team_id: number | null;
  is_starter: boolean;
  slot: number;
  status: string | null;
  chance: number | null;
};

export type TeaserProblemFacts = {
  locale: TeaserLocale;
  overallRank: number | null;
  lastGw: number | null;
  lastGwPoints: number | null;
  prevOverallRank: number | null;
  nextGw: number | null;
  league: { name: string; rank: number | null; gap: number | null } | null;
  freeTransfers: number;
  flags: TeaserSquadFlag[];
};

const LEAK_KEYS = [
  "suggestions",
  "recommendedXi",
  "captainPick",
  "in_fpl_id",
  "xp_delta",
  "theyHave",
  "youHave",
];

const LEAK_PHRASES = [
  "买入",
  "换成",
  "卖出",
  "推荐队长",
  "推荐首发",
  "bring in",
  "sell for",
  "recommended captain",
];

export function formatOverallRank(
  n: number | null,
  locale: TeaserLocale,
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (locale === "zh" && n >= 10_000) {
    const wan = n / 10_000;
    const label =
      wan >= 1000 ? `${Math.round(wan)}` : wan.toFixed(1).replace(/\.0$/, "");
    return `${label}万`;
  }
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-GB").format(n);
}

export function formatDeadlineLabel(
  iso: string | null,
  locale: TeaserLocale,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const fmt = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return locale === "zh" ? `北京 ${fmt.format(d)}` : `Beijing ${fmt.format(d)}`;
}

function isRiskStatus(status: string | null, chance: number | null): boolean {
  const s = (status ?? "a").toLowerCase();
  if (s === "i" || s === "d" || s === "s" || s === "u" || s === "n") return true;
  if (chance != null && chance < 50) return true;
  return false;
}

function pickSellCandidate(flags: TeaserSquadFlag[]): TeaserSquadFlag | null {
  const named = flags.filter((f) => (f.web_name ?? "").trim());
  const riskStarters = named
    .filter((f) => f.is_starter && isRiskStatus(f.status, f.chance))
    .sort(
      (a, b) =>
        (a.chance ?? 100) - (b.chance ?? 100) || a.slot - b.slot,
    );
  if (riskStarters[0]) return riskStarters[0];
  const starter = named
    .filter((f) => f.is_starter && (f.position ?? "").toUpperCase() !== "GKP")
    .sort((a, b) => a.slot - b.slot)[0];
  return starter ?? named[0] ?? null;
}

export function redactedPlanLine(
  flags: TeaserSquadFlag[],
  locale: TeaserLocale,
): string {
  const sell = pickSellCandidate(flags);
  const name = sell?.web_name.trim() || (locale === "zh" ? "一人" : "a starter");
  return locale === "zh"
    ? `报告建议：卖走 ${name} 买进 XXX 报告分析利与弊`
    : `Report pick: sell ${name} for XXX — unlock for the trade-off`;
}

function rankMoveLine(
  prev: number | null,
  now: number | null,
  locale: TeaserLocale,
): string | null {
  if (prev == null || now == null || !Number.isFinite(prev) || !Number.isFinite(now)) {
    return null;
  }
  const delta = prev - now;
  const zh = locale === "zh";
  if (delta === 0) return zh ? "排名没动" : "rank unchanged";
  const abs = formatOverallRank(Math.abs(delta), locale);
  if (delta > 0) return zh ? `排名升了 ${abs}` : `climbed ${abs}`;
  return zh ? `排名掉了 ${abs}` : `dropped ${abs}`;
}

/** Overall rank, one mini-league, coming-GW transfer tease. Never names the IN. */
export function buildTeaserProblems(facts: TeaserProblemFacts): TeaserProblem[] {
  const zh = facts.locale === "zh";
  const rankLabel = formatOverallRank(facts.overallRank, facts.locale);
  const move = rankMoveLine(
    facts.prevOverallRank,
    facts.overallRank,
    facts.locale,
  );
  const gwBit =
    facts.lastGw != null
      ? zh
        ? `上轮 GW${facts.lastGw}`
        : `GW${facts.lastGw}`
      : zh
        ? "上轮"
        : "Last GW";
  const ptsBit =
    facts.lastGwPoints != null
      ? zh
        ? `拿了 ${facts.lastGwPoints} 分`
        : `scored ${facts.lastGwPoints}`
      : null;
  const overallBits = [
    zh ? `现在总榜第 ${rankLabel}` : `Overall rank ${rankLabel}`,
    ptsBit ? `${gwBit} ${ptsBit}` : null,
    move,
  ].filter(Boolean);
  const overallBody = zh
    ? `${overallBits.join("，")}。要有绿箭头 看样本教你怎么走`
    : `${overallBits.join(" · ")}. Green arrows — the sample shows how.`;

  let leagueBody: string;
  if (facts.league?.name) {
    const rank =
      facts.league.rank != null
        ? zh
          ? `你现在第 ${facts.league.rank}`
          : `rank ${facts.league.rank}`
        : zh
          ? "名次待更新"
          : "rank pending";
    const gapBit =
      facts.league.gap != null
        ? zh
          ? `，距榜首 ${facts.league.gap} 分`
          : `, ${facts.league.gap} pts behind the leader`
        : "";
    leagueBody = zh
      ? `「${facts.league.name}」${rank}${gapBit}。周冠军、月冠军 报告帮你冲一冲`
      : `"${facts.league.name}" ${rank}${gapBit}. GW / monthly titles — the note helps you climb.`;
  } else {
    leagueBody = zh
      ? "没有读到私人小联赛。把联赛放进阵容后，完整报告会按那个联赛写追分。"
      : "No private mini-league on this entry. Unlock after you add one.";
  }

  const ft = Math.max(0, facts.freeTransfers);
  const gwPlan =
    facts.nextGw != null ? (zh ? `GW${facts.nextGw}` : `GW${facts.nextGw}`) : zh ? "本周" : "This GW";
  const transferBody = zh
    ? `${gwPlan} 你有 ${ft} 次免费转会。${redactedPlanLine(facts.flags, facts.locale)}`
    : `${gwPlan}: ${ft} FT. ${redactedPlanLine(facts.flags, facts.locale)}`;

  return [
    {
      kind: "overall",
      title: zh ? "总排名" : "Overall rank",
      body: overallBody,
    },
    {
      kind: "league",
      title: zh ? "小联赛" : "Mini-league",
      body: leagueBody,
    },
    {
      kind: "transfer",
      title: zh ? "本周转会" : "This GW transfer",
      body: transferBody,
    },
  ];
}

export function teaserLeakReasons(payload: unknown): string[] {
  const reasons: string[] = [];
  const json = JSON.stringify(payload);
  for (const key of LEAK_KEYS) {
    if (new RegExp(`"${key}"\\s*:`).test(json)) reasons.push(`key:${key}`);
  }
  const lower = json.toLowerCase();
  for (const phrase of LEAK_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) reasons.push(`phrase:${phrase}`);
  }
  return reasons;
}

function pickMiniLeague(
  classic: FplClassicLeague[] | undefined,
): FplClassicLeague | null {
  const list = classic ?? [];
  const priv = list.filter((l) => (l.league_type ?? "") === "x");
  const named =
    priv.find((l) => /AI League/i.test(l.name ?? "")) ??
    list.find((l) => /AI League/i.test(l.name ?? ""));
  if (named) return named;
  const pool = priv.length ? priv : list.filter((l) => l.id !== 314);
  if (pool.length === 0) return null;
  const notFirst = pool.filter((l) => (l.entry_rank ?? 1) > 1);
  return [...(notFirst.length ? notFirst : pool)].sort(
    (a, b) => (b.entry_rank ?? 0) - (a.entry_rank ?? 0),
  )[0];
}

function lockedBlocks(locale: TeaserLocale): TeaserLockedBlock[] {
  if (locale === "zh") {
    return [
      { id: "ft", label: "精确 IN → OUT 与转会排序表" },
      { id: "xi", label: "建议首发 XI / 球场图、C/VC、板凳 13–15" },
      { id: "league", label: "小联赛 4 轮冲击规划" },
      { id: "evidence", label: "硬核数据支持、模型智能筛选方案" },
      { id: "revise", label: "含一次修订" },
    ];
  }
  return [
    { id: "ft", label: "Exact IN → OUT and ranked FT table" },
    { id: "xi", label: "Recommended XI / pitch, C/VC, bench 13–15" },
    { id: "league", label: "Mini-league 4-GW climb plan" },
    { id: "evidence", label: "Hard data + model-filtered options" },
    { id: "revise", label: "One revision included" },
  ];
}

type HistoryJson = {
  current?: Array<{
    event: number;
    points?: number;
    overall_rank?: number;
    points_on_bench?: number;
  }>;
};

type StandingsJson = {
  league?: { name?: string };
  standings?: {
    results?: Array<{
      rank: number;
      entry: number;
      total: number;
    }>;
  };
};

type StaticRow = {
  fpl_id: number;
  status: string | null;
  chance_of_playing: number | null;
  news: string | null;
};

async function loadStaticFlags(
  picks: FplSquadPick[],
): Promise<Map<number, StaticRow>> {
  const ids = picks.map((p) => p.fpl_id);
  const map = new Map<number, StaticRow>();
  if (ids.length === 0) return map;
  const supa = getServerSupabase();
  const { data } = await supa
    .from("players_static")
    .select("fpl_id,status,chance_of_playing,news")
    .in("fpl_id", ids);
  for (const r of data ?? []) {
    map.set(Number(r.fpl_id), {
      fpl_id: Number(r.fpl_id),
      status: (r.status as string | null) ?? null,
      chance_of_playing:
        typeof r.chance_of_playing === "number" ? r.chance_of_playing : null,
      news: (r.news as string | null) ?? null,
    });
  }
  return map;
}

export async function buildProTeaser(
  entryId: number,
  locale: TeaserLocale,
): Promise<ProTeaser> {
  const entry = await validateFplEntryExists(entryId);
  const gwCtx = await getMiniGameweekContext();

  const [team, history] = await Promise.all([
    fetchTeamForUi(entryId, false),
    fplGet<HistoryJson>(`/entry/${entryId}/history/`).catch(() => null),
  ]);

  const picks = picksForPlanning(team);
  if (picks.length === 0) {
    throw new Error("No squad picks available for this entry.");
  }

  const staticById = await loadStaticFlags(picks);
  const flags: TeaserSquadFlag[] = picks.map((p) => {
    const st = staticById.get(p.fpl_id);
    return {
      web_name: p.web_name ?? p.name ?? `#${p.fpl_id}`,
      position: p.position,
      team: p.team,
      team_id: p.team_id ?? null,
      is_starter: p.is_starter,
      slot: p.slot,
      status: st?.status ?? null,
      chance: st?.chance_of_playing ?? null,
    };
  });

  const mini = pickMiniLeague(entry.leagues?.classic);
  let gap: number | null = null;
  if (mini?.id) {
    try {
      const standings = await fplGet<StandingsJson>(
        `/leagues-classic/${mini.id}/standings/?page_standings=1`,
      );
      const rows = standings.standings?.results ?? [];
      const you = rows.find((r) => r.entry === entryId);
      const leader = rows[0];
      if (you && leader && leader.entry !== entryId) {
        gap = Math.max(0, leader.total - you.total);
      }
    } catch {
      gap = null;
    }
  }

  const chips = computeChipsRemaining(team.chips_used ?? []);
  const chipsLabel =
    locale === "zh"
      ? `WC ${chips.wildcardsRemaining} · FH ${chips.freeHitsRemaining} · BB ${chips.benchBoostsRemaining} · TC ${chips.tripleCaptainsRemaining}`
      : `WC ${chips.wildcardsRemaining} · FH ${chips.freeHitsRemaining} · BB ${chips.benchBoostsRemaining} · TC ${chips.tripleCaptainsRemaining}`;

  const histRows = history?.current ?? [];
  const lastHist = histRows.at(-1);
  const prevHist = histRows.at(-2);

  const league = mini
    ? {
        name: mini.name,
        rank: mini.entry_rank ?? null,
        gap,
      }
    : null;

  const problems = buildTeaserProblems({
    locale,
    overallRank: entry.summary_overall_rank ?? lastHist?.overall_rank ?? null,
    lastGw: lastHist?.event ?? null,
    lastGwPoints: lastHist?.points ?? null,
    prevOverallRank: prevHist?.overall_rank ?? null,
    nextGw: gwCtx.submission_gw,
    league,
    freeTransfers: team.free_transfers ?? 1,
    flags,
  });

  const managerName =
    `${entry.player_first_name ?? ""} ${entry.player_last_name ?? ""}`
      .trim()
      .replace(/\s+/g, " ") || "—";

  const teaser: ProTeaser = {
    entryId,
    teamName: (entry.name ?? "").trim() || `Entry #${entryId}`,
    managerName,
    snapshot: {
      points: entry.summary_overall_points,
      overallRank: entry.summary_overall_rank,
      overallRankLabel: formatOverallRank(entry.summary_overall_rank, locale),
      bankLabel: `£${Number(team.bank).toFixed(1)}m`,
      freeTransfers: team.free_transfers ?? 1,
      chipsLabel,
      nextGw: gwCtx.submission_gw,
      deadlineIso: gwCtx.deadline_time,
      deadlineLabel: formatDeadlineLabel(gwCtx.deadline_time, locale),
    },
    league,
    problems,
    redactedPlan: redactedPlanLine(flags, locale),
    locked: lockedBlocks(locale),
  };

  const leaks = teaserLeakReasons(teaser);
  if (leaks.length) {
    throw new Error(`Teaser leak: ${leaks.join(", ")}`);
  }
  return teaser;
}

/** Fixture teaser for local preview when FPL is 503. Same copy path as live. */
export function buildPreviewProTeaser(locale: TeaserLocale): ProTeaser {
  const flags: TeaserSquadFlag[] = [
    {
      web_name: "Richards",
      position: "DEF",
      team: "Crystal Palace",
      team_id: 7,
      is_starter: true,
      slot: 2,
      status: "a",
      chance: 100,
    },
    {
      web_name: "Mitchell",
      position: "DEF",
      team: "Crystal Palace",
      team_id: 7,
      is_starter: true,
      slot: 3,
      status: "a",
      chance: 100,
    },
    {
      web_name: "E.Le Fée",
      position: "MID",
      team: "Sunderland",
      team_id: 20,
      is_starter: true,
      slot: 8,
      status: "d",
      chance: 25,
    },
  ];
  const league = { name: "AI League", rank: 16, gap: 63 };
  const problems = buildTeaserProblems({
    locale,
    overallRank: 1_640_000,
    lastGw: 6,
    lastGwPoints: 48,
    prevOverallRank: 1_520_000,
    nextGw: 7,
    league,
    freeTransfers: 1,
    flags,
  });
  const teaser: ProTeaser = {
    entryId: 916934,
    teamName: locale === "zh" ? "样本阵容（预览）" : "Sample squad (preview)",
    managerName: locale === "zh" ? "不走 FPL 实时接口" : "Offline FPL preview",
    snapshot: {
      points: 284,
      overallRank: 1_640_000,
      overallRankLabel: formatOverallRank(1_640_000, locale),
      bankLabel: "£1.0m",
      freeTransfers: 1,
      chipsLabel: "WC 2 · FH 2 · BB 2 · TC 2",
      nextGw: 7,
      deadlineIso: "2026-10-03T10:00:00Z",
      deadlineLabel: formatDeadlineLabel("2026-10-03T10:00:00Z", locale),
    },
    league,
    problems,
    redactedPlan: redactedPlanLine(flags, locale),
    locked: lockedBlocks(locale),
  };
  const leaks = teaserLeakReasons(teaser);
  if (leaks.length) {
    throw new Error(`Teaser leak: ${leaks.join(", ")}`);
  }
  return teaser;
}

/** Narrow 404 vs other FPL failures for the API. */
export function isMissingFplEntry(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /-> 404|not found/i.test(msg);
}

export function parseTeaserEntryId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n <= 0 || n > 99_999_999) return null;
  return Math.trunc(n);
}
