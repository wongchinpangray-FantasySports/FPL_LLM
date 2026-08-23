import { fplGet } from "@/lib/fpl";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { loadSetPiecesRaw } from "@/lib/fpl/insights/set-pieces";
import { plTeamNameZh } from "@/lib/fpl/pl-team-names-zh";
import { getServerSupabase } from "@/lib/supabase";
import {
  resolveWechatCardSiteUrl,
  shanghaiDateIso,
  WECHAT_CARD_TZ,
} from "@/lib/fpl/wechat-daily-card";
import { loadTeams, resolveCurrentGw, type Fixture } from "@/lib/xp";

const POSITION_BY_TYPE: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

const STATUS_ZH: Record<string, string> = {
  d: "疑似",
  i: "受伤",
  s: "停赛",
  u: "无法出场",
};

export const MATCHDAY_HORIZON_HOURS = 14;
export const MATCHDAY_LOOKBACK_MINUTES = 30;

export type MatchdayFixtureNote = {
  id: number;
  gw: number;
  kickoff: string | null;
  kickoff_sh: string;
  home: string;
  away: string;
  home_short: string;
  away_short: string;
  home_fdr: number | null;
  away_fdr: number | null;
  finished: boolean;
};

export type MatchdayInjuryNote = {
  web_name: string;
  team: string;
  status: string;
  chance: number | null;
  news: string;
};

export type MatchdayWatchNote = {
  web_name: string;
  team: string;
  position: string;
  ep: number;
  price: number;
  fixture: string;
};

export type MatchdaySetPieceNote = {
  team: string;
  penalties: string | null;
  corners: string | null;
};

export type WechatMatchdayData = {
  card_date: string;
  gw: number;
  window_hours: number;
  fixtures: MatchdayFixtureNote[];
  injuries: MatchdayInjuryNote[];
  watches: MatchdayWatchNote[];
  set_pieces: MatchdaySetPieceNote[];
  discussion_prompt: string;
  text: string;
  skipped: boolean;
  skip_reason: string | null;
};

type BootstrapElement = {
  id: number;
  web_name?: string;
  team: number;
  element_type?: number;
  now_cost?: number;
  status?: string;
  news?: string;
  chance_of_playing_this_round?: number | null;
  chance_of_playing_next_round?: number | null;
  ep_this?: string | number;
  minutes?: number;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isKickoffInWindow(
  kickoffIso: string | null,
  asOf: Date,
  horizonHours = MATCHDAY_HORIZON_HOURS,
  lookbackMinutes = MATCHDAY_LOOKBACK_MINUTES,
): boolean {
  if (!kickoffIso) return false;
  const t = new Date(kickoffIso).getTime();
  if (!Number.isFinite(t)) return false;
  const start = asOf.getTime() - lookbackMinutes * 60_000;
  const end = asOf.getTime() + horizonHours * 3600_000;
  return t >= start && t <= end;
}

export function formatShanghaiKickoff(iso: string | null): string {
  if (!iso) return "时间待定";
  try {
    const sh = new Intl.DateTimeFormat("zh-CN", {
      timeZone: WECHAT_CARD_TZ,
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
    const uk = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
    return `${sh} 上海（英国 ${uk}）`;
  } catch {
    return iso;
  }
}

function fmtShTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: WECHAT_CARD_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function discussionPrompt(fixtures: MatchdayFixtureNote[]): string {
  if (fixtures.length === 1) {
    return `${fixtures[0]!.home} vs ${fixtures[0]!.away} — 你的队长锁谁？`;
  }
  if (fixtures.length >= 4) {
    return "今晚这么多场，你最看好哪场爆冷 / 哪场大胜？";
  }
  return "今晚队长是谁？有没有你想避开的一场？";
}

async function loadWindowFixtures(
  asOf: Date,
  horizonHours: number,
): Promise<{ gw: number; fixtures: Fixture[] }> {
  const season = await getCurrentFplSeason();
  const { current, next } = await resolveCurrentGw();
  const fromGw = Math.max(1, current - 1);
  const toGw = next || current;
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("fixtures")
    .select(
      "id,gw,home_team_id,away_team_id,home_fdr,away_fdr,finished,kickoff_time",
    )
    .eq("season", season)
    .gte("gw", fromGw)
    .lte("gw", toGw)
    .order("kickoff_time", { ascending: true });
  if (error) throw new Error(error.message);

  const all = (data ?? []) as unknown as Fixture[];
  const open = all.filter(
    (f) =>
      !f.finished &&
      isKickoffInWindow(f.kickoff_time, asOf, horizonHours),
  );
  const gw =
    open[0]?.gw ??
    all.find((f) => !f.finished)?.gw ??
    current;
  return { gw, fixtures: open };
}

function formatMatchdayText(data: Omit<WechatMatchdayData, "text">): string {
  const lines: string[] = [
    `⚽ 比赛日要点 · GW${data.gw} · ${data.card_date}`,
    "",
  ];

  lines.push("📋 赛程（上海时间）");
  for (const f of data.fixtures) {
    lines.push(
      `• ${fmtShTime(f.kickoff)}  ${f.home} vs ${f.away}`,
    );
  }
  lines.push("");

  if (data.injuries.length) {
    lines.push("⚠️ 伤病 / 出战风险");
    for (const row of data.injuries.slice(0, 8)) {
      const chance =
        row.chance != null ? ` · 出战 ${Math.round(row.chance)}%` : "";
      lines.push(`• ${row.web_name}（${row.team}）${row.status}${chance}`);
    }
    lines.push("");
  }

  if (data.watches.length) {
    lines.push("⭐ 本场看点（FPL EP）");
    for (const row of data.watches.slice(0, 8)) {
      lines.push(
        `• ${row.web_name}  EP ${row.ep.toFixed(1)}  ${row.fixture}  £${row.price.toFixed(1)}m`,
      );
    }
    lines.push("");
  }

  if (data.set_pieces.length) {
    lines.push("📌 定位球");
    for (const row of data.set_pieces.slice(0, 8)) {
      const bits = [
        row.penalties ? `点球 ${row.penalties}` : null,
        row.corners ? `角球 ${row.corners}` : null,
      ].filter(Boolean);
      if (!bits.length) continue;
      lines.push(`• ${row.team}：${bits.join(" · ")}`);
    }
    lines.push("");
  }

  lines.push(`💬 讨论：${data.discussion_prompt}`);
  lines.push("");
  const site = resolveWechatCardSiteUrl();
  lines.push("🔗 链接");
  lines.push(`赛程：${site}/zh/fpl/fixtures`);
  lines.push(`身价预测：${site}/zh/fpl/insights/price-forecast`);
  lines.push(`Insights：${site}/zh/fpl/insights`);

  return lines.join("\n").trimEnd();
}

export async function buildWechatMatchday(opts?: {
  asOf?: Date;
  horizonHours?: number;
}): Promise<WechatMatchdayData> {
  const asOf = opts?.asOf ?? new Date();
  const horizonHours = opts?.horizonHours ?? MATCHDAY_HORIZON_HOURS;
  const cardDate = shanghaiDateIso(asOf);

  const { gw, fixtures } = await loadWindowFixtures(asOf, horizonHours);
  if (fixtures.length === 0) {
    return {
      card_date: cardDate,
      gw,
      window_hours: horizonHours,
      fixtures: [],
      injuries: [],
      watches: [],
      set_pieces: [],
      discussion_prompt: "",
      text: "",
      skipped: true,
      skip_reason: `接下来 ${horizonHours} 小时内没有未开赛的英超比赛`,
    };
  }

  const teams = await loadTeams();
  const teamIds = new Set<number>();
  const fixtureNotes: MatchdayFixtureNote[] = fixtures.map((f) => {
    teamIds.add(f.home_team_id);
    teamIds.add(f.away_team_id);
    const home = teams.get(f.home_team_id);
    const away = teams.get(f.away_team_id);
    return {
      id: f.id,
      gw: f.gw,
      kickoff: f.kickoff_time,
      kickoff_sh: formatShanghaiKickoff(f.kickoff_time),
      home: plTeamNameZh(home?.short, home?.name),
      away: plTeamNameZh(away?.short, away?.name),
      home_short: home?.short ?? "",
      away_short: away?.short ?? "",
      home_fdr: f.home_fdr,
      away_fdr: f.away_fdr,
      finished: f.finished,
    };
  });

  const oppLabel = (teamId: number): string => {
    const fx = fixtures.find(
      (f) => f.home_team_id === teamId || f.away_team_id === teamId,
    );
    if (!fx) return "";
    const home = teamId === fx.home_team_id;
    const oppId = home ? fx.away_team_id : fx.home_team_id;
    const opp = teams.get(oppId);
    const name = plTeamNameZh(opp?.short, opp?.name);
    return home ? `vs ${name}（主）` : `vs ${name}（客）`;
  };

  let elements: BootstrapElement[] = [];
  try {
    const raw = await fplGet<{ elements?: BootstrapElement[] }>(
      "/bootstrap-static/",
    );
    elements = raw.elements ?? [];
  } catch {
    elements = [];
  }

  const playing = elements.filter((el) => teamIds.has(el.team));

  const injuries: MatchdayInjuryNote[] = playing
    .filter((el) => {
      const s = (el.status ?? "a").toLowerCase();
      const chance =
        num(el.chance_of_playing_this_round) ??
        num(el.chance_of_playing_next_round);
      if (s === "s") return true;
      if (s === "d") return chance == null || chance < 100;
      // Long-term 0% absences are not matchday news.
      if (s === "i") return chance != null && chance > 0 && chance < 100;
      return false;
    })
    .map((el) => {
      const team = teams.get(el.team);
      const chance =
        num(el.chance_of_playing_this_round) ??
        num(el.chance_of_playing_next_round);
      return {
        web_name: el.web_name?.trim() || `#${el.id}`,
        team: plTeamNameZh(team?.short, team?.name),
        status: STATUS_ZH[(el.status ?? "d").toLowerCase()] ?? "出战存疑",
        chance,
        news: String(el.news ?? "").trim(),
      };
    })
    .sort((a, b) => (a.chance ?? 99) - (b.chance ?? 99));

  const watchPool = playing
    .filter((el) => {
      const s = (el.status ?? "a").toLowerCase();
      return s === "a" || s === "d";
    })
    .map((el) => {
      const team = teams.get(el.team);
      const priceTenths = num(el.now_cost);
      return {
        web_name: el.web_name?.trim() || `#${el.id}`,
        team: plTeamNameZh(team?.short, team?.name),
        position: POSITION_BY_TYPE[el.element_type ?? 0] ?? "",
        ep: num(el.ep_this) ?? 0,
        price: priceTenths != null ? Math.round(priceTenths) / 10 : 0,
        fixture: oppLabel(el.team),
      };
    })
    .sort((a, b) => b.ep - a.ep);
  const hotWatches = watchPool.filter((row) => row.ep >= 3);
  const watches: MatchdayWatchNote[] = (
    hotWatches.length >= 5 ? hotWatches : watchPool
  ).slice(0, 8);

  let setPieces: MatchdaySetPieceNote[] = [];
  try {
    const sp = await loadSetPiecesRaw();
    setPieces = [...teamIds]
      .map((tid) => {
        const team = teams.get(tid);
        const label = plTeamNameZh(team?.short, team?.name);
        const rows = sp.rows.filter((r) => r.team_id === tid);
        const pen = rows.find((r) => r.penalties_order === 1)?.web_name ?? null;
        const cor = rows.find((r) => r.corners_order === 1)?.web_name ?? null;
        return { team: label, penalties: pen, corners: cor };
      })
      .filter((r) => r.penalties || r.corners);
  } catch {
    setPieces = [];
  }

  const base: Omit<WechatMatchdayData, "text"> = {
    card_date: cardDate,
    gw,
    window_hours: horizonHours,
    fixtures: fixtureNotes,
    injuries,
    watches,
    set_pieces: setPieces,
    discussion_prompt: discussionPrompt(fixtureNotes),
    skipped: false,
    skip_reason: null,
  };

  return { ...base, text: formatMatchdayText(base) };
}
