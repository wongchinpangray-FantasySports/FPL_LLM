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
import { loadClubFormRaw } from "@/lib/fpl/team-form";
import { getServerSupabase } from "@/lib/supabase";

export type TeaserLocale = "zh" | "en";

export type TeaserProblem = {
  kind:
    | "injury"
    | "bench_trap"
    | "league_gap"
    | "club_def"
    | "ft"
    | "chips"
    | "bank";
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
  bank: number;
  freeTransfers: number;
  chipsAllRemaining: boolean;
  league: { name: string; rank: number | null; gap: number | null } | null;
  flags: TeaserSquadFlag[];
  clubDefStacks: Array<{ team: string; n: number; leaky: boolean }>;
  pointsOnBenchLast: number | null;
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

function posWord(pos: string | null, locale: TeaserLocale): string {
  const p = (pos ?? "").toUpperCase();
  if (locale === "zh") {
    if (p === "DEF") return "后卫";
    if (p === "MID") return "中场";
    if (p === "FWD") return "前锋";
    if (p === "GKP") return "门将";
    return "位置";
  }
  if (p === "DEF") return "DEF";
  if (p === "MID") return "MID";
  if (p === "FWD") return "FWD";
  if (p === "GKP") return "GKP";
  return "slot";
}

export function redactedPlanLine(
  flags: TeaserSquadFlag[],
  locale: TeaserLocale,
): string {
  const risk = flags
    .filter((f) => f.is_starter && isRiskStatus(f.status, f.chance))
    .sort((a, b) => a.slot - b.slot)[0];
  const pos = posWord(risk?.position ?? null, locale);
  return locale === "zh"
    ? `默认方案：${pos} × → …（开通后写清 IN/OUT 与价格）`
    : `Default plan: ${pos} × → … (names and prices after unlock)`;
}

export function buildTeaserProblems(facts: TeaserProblemFacts): TeaserProblem[] {
  const { locale } = facts;
  const out: TeaserProblem[] = [];
  const zh = locale === "zh";

  const riskStarters = facts.flags.filter(
    (f) => f.is_starter && isRiskStatus(f.status, f.chance),
  );
  if (riskStarters.length > 0) {
    const names = riskStarters
      .slice(0, 2)
      .map((f) => f.web_name)
      .join(zh ? "、" : ", ");
    out.push({
      kind: "injury",
      title: zh ? "出战风险" : "Availability",
      body: zh
        ? `首发里有出战问题：${names}。开通PRO了解实际操作建议。`
        : `Starter availability issue: ${names}. The full note names the replacement, the price, and bench order.`,
    });
  }

  const starterDefs = facts.flags.filter(
    (f) => f.is_starter && (f.position ?? "").toUpperCase() === "DEF",
  );
  const benchTrap =
    riskStarters.length > 0 &&
    (starterDefs.length <= 3 || (facts.pointsOnBenchLast ?? 0) >= 6);
  if (benchTrap) {
    out.push({
      kind: "bench_trap",
      title: zh ? "自动换人陷阱" : "Auto-sub trap",
      body: zh
        ? "本周可能自动换人。板凳顺序要按阵型算——放错第 13 人会吃掉每一次替补。开通后写清 13 / 14 / 15。"
        : "Autosubs may fire. Bench order depends on formation — the 13th pick can swallow every sub. Unlock for 13 / 14 / 15.",
    });
  }

  if (facts.league && facts.league.rank != null) {
    const gapBit =
      facts.league.gap != null
        ? zh
          ? `，距榜首 ${facts.league.gap} 分`
          : `, ${facts.league.gap} pts behind the leader`
        : "";
    out.push({
      kind: "league_gap",
      title: zh ? "小联赛位置" : "Mini-league",
      body: zh
        ? `「${facts.league.name}」第 ${facts.league.rank}${gapBit}。开通PRO解锁冲击路径和 4 轮规划完整报告。`
        : `"${facts.league.name}" rank ${facts.league.rank}${gapBit}. Unlock PRO for the climb path and 4-GW plan.`,
    });
  }

  const leakyStack = facts.clubDefStacks.find((c) => c.n >= 2 && c.leaky);
  const anyStack = facts.clubDefStacks.find((c) => c.n >= 2);
  const stack = leakyStack ?? anyStack;
  if (stack) {
    out.push({
      kind: "club_def",
      title: zh ? "后防同队" : "Same-club defence",
      body: zh
        ? `后防有 ${stack.n} 人同属 ${stack.team}。零封要看整队 xGA / 红牌队友，不能只看球员 xP。开通PRO后了解买谁卖谁。`
        : `${stack.n} defenders from ${stack.team}. CS is a club call (xGA / cards), not player xP. Unlock PRO to see who to buy and sell.`,
    });
  }

  if (facts.freeTransfers >= 1) {
    out.push({
      kind: "ft",
      title: zh ? "免费转会" : "Free transfer",
      body: zh
        ? `你有 ${facts.freeTransfers} 次免费转会。默认方案不会先让你 -4；开通PRO后获取更多转会方案。`
        : `You have ${facts.freeTransfers} FT. The default plan will not take a -4 first. Unlock PRO for more transfer options.`,
    });
  }

  if (facts.chipsAllRemaining) {
    out.push({
      kind: "chips",
      title: zh ? "卡还在" : "Chips unused",
      body: zh
        ? "卡都还在。本周开不开、开哪张，开通PRO了解实际操作建议——报告样本里不会先让你烧卡。"
        : "All chips remain. Whether to play one this GW is in the full note — the teaser will not burn a chip.",
    });
  }

  if (facts.bank >= 0) {
    out.push({
      kind: "bank",
      title: zh ? "银行" : "Bank",
      body: zh
        ? `银行 £${facts.bank.toFixed(1)}m。换人必须卡在这个预算里，开通后写清差价。`
        : `Bank £${facts.bank.toFixed(1)}m. The paid note fits the IN inside this budget.`,
    });
  }

  const picked: TeaserProblem[] = [];
  const seen = new Set<TeaserProblem["kind"]>();
  for (const p of out) {
    if (seen.has(p.kind)) continue;
    seen.add(p.kind);
    picked.push(p);
    if (picked.length >= 3) break;
  }
  return picked;
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
  current?: Array<{ event: number; points_on_bench?: number }>;
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
  const throughGw = Math.max(1, (gwCtx.submission_gw ?? gwCtx.scoring_gw) - 1);

  const [team, clubForm, history] = await Promise.all([
    fetchTeamForUi(entryId, false),
    loadClubFormRaw({ throughGw }).catch(() => null),
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

  const defByTeam = new Map<
    number,
    { team: string; n: number; leaky: boolean }
  >();
  for (const f of flags) {
    if (!f.is_starter || (f.position ?? "").toUpperCase() !== "DEF") continue;
    if (f.team_id == null) continue;
    const club = clubForm?.byTeam.get(f.team_id);
    const prev = defByTeam.get(f.team_id);
    const leaky =
      club?.def_use === "dc" ||
      (club?.defence_leak ?? 0) >= 1.15 ||
      (club?.luck_cs ?? 0) < -0.05;
    if (prev) {
      prev.n += 1;
      prev.leaky = prev.leaky || leaky;
    } else {
      defByTeam.set(f.team_id, {
        team: f.team ?? club?.short ?? `#${f.team_id}`,
        n: 1,
        leaky,
      });
    }
  }

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
  const chipsAllRemaining =
    chips.wildcardsRemaining >= 2 &&
    chips.freeHitsRemaining >= 2 &&
    chips.benchBoostsRemaining >= 2 &&
    chips.tripleCaptainsRemaining >= 2;
  const chipsLabel =
    locale === "zh"
      ? `WC ${chips.wildcardsRemaining} · FH ${chips.freeHitsRemaining} · BB ${chips.benchBoostsRemaining} · TC ${chips.tripleCaptainsRemaining}`
      : `WC ${chips.wildcardsRemaining} · FH ${chips.freeHitsRemaining} · BB ${chips.benchBoostsRemaining} · TC ${chips.tripleCaptainsRemaining}`;

  const lastHist = (history?.current ?? []).at(-1);
  const pointsOnBenchLast =
    typeof lastHist?.points_on_bench === "number"
      ? lastHist.points_on_bench
      : null;

  const league = mini
    ? {
        name: mini.name,
        rank: mini.entry_rank ?? null,
        gap,
      }
    : null;

  const problems = buildTeaserProblems({
    locale,
    bank: team.bank,
    freeTransfers: team.free_transfers ?? 1,
    chipsAllRemaining,
    league,
    flags,
    clubDefStacks: [...defByTeam.values()],
    pointsOnBenchLast,
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
