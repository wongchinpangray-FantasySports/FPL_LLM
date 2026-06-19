import type { WcScoutingReport } from "@/lib/wc/scouting";
import type { WcMatchGoal, WcMatchRow } from "@/lib/wc/fifa-rounds";
import type { LeaderboardRow } from "@/lib/wc/standings";
import {
  displayPlayerName,
  isChineseLocale,
  resolveChinesePlayerNameMap,
} from "@/lib/wc/player-names-zh";

function collectNamesFromMatches(matches: WcMatchRow[]): string[] {
  const names: string[] = [];
  for (const m of matches) {
    for (const g of [...m.home_goals, ...m.away_goals]) {
      names.push(g.scorer_display || g.scorer);
      if (g.assist_display || g.assist) {
        names.push(g.assist_display || g.assist!);
      }
    }
    for (const c of [...m.home_cards, ...m.away_cards]) {
      names.push(c.player_display || c.player);
    }
  }
  return names;
}

function localizeGoal(
  g: WcMatchGoal,
  locale: string,
  zhMap: Map<string, string>,
): WcMatchGoal {
  const scorer = g.scorer_display || g.scorer;
  const assist = g.assist_display || g.assist;
  return {
    ...g,
    scorer_display: displayPlayerName(scorer, locale, zhMap),
    assist_display: assist
      ? displayPlayerName(assist, locale, zhMap)
      : null,
  };
}

export async function localizeWcMatches(
  matches: WcMatchRow[],
  locale: string,
): Promise<WcMatchRow[]> {
  if (!isChineseLocale(locale)) return matches;
  const zhMap = await resolveChinesePlayerNameMap(collectNamesFromMatches(matches));
  return matches.map((m) => ({
    ...m,
    home_goals: m.home_goals.map((g) => localizeGoal(g, locale, zhMap)),
    away_goals: m.away_goals.map((g) => localizeGoal(g, locale, zhMap)),
    home_cards: m.home_cards.map((c) => ({
      ...c,
      player_display: displayPlayerName(
        c.player_display || c.player,
        locale,
        zhMap,
      ),
    })),
    away_cards: m.away_cards.map((c) => ({
      ...c,
      player_display: displayPlayerName(
        c.player_display || c.player,
        locale,
        zhMap,
      ),
    })),
  }));
}

export async function localizeLeaderboardRows(
  rows: LeaderboardRow[],
  locale: string,
  extraNames: string[] = [],
): Promise<LeaderboardRow[]> {
  if (!isChineseLocale(locale)) return rows;
  const names = [...rows.map((r) => r.name), ...extraNames];
  const zhMap = await resolveChinesePlayerNameMap(names);
  return rows.map((r) => ({
    ...r,
    name: displayPlayerName(r.name, locale, zhMap),
  }));
}

export async function localizeNamedRows<T extends { name: string }>(
  rows: T[],
  locale: string,
): Promise<T[]> {
  if (!isChineseLocale(locale)) return rows;
  const zhMap = await resolveChinesePlayerNameMap(rows.map((r) => r.name));
  return rows.map((r) => ({
    ...r,
    name: displayPlayerName(r.name, locale, zhMap),
  }));
}

export async function localizeScoutingReport(
  report: WcScoutingReport,
  locale: string,
): Promise<WcScoutingReport> {
  if (!isChineseLocale(locale)) return report;
  const names = Object.values(report.picks).flatMap((bucket) =>
    bucket.map((p) => p.name),
  );
  const zhMap = await resolveChinesePlayerNameMap(names);
  const picks = { ...report.picks };
  for (const key of Object.keys(picks) as (keyof typeof picks)[]) {
    picks[key] = picks[key].map((p) => ({
      ...p,
      name: displayPlayerName(p.name, locale, zhMap),
      fpl_web_name: p.fpl_web_name
        ? displayPlayerName(p.fpl_web_name, locale, zhMap)
        : null,
    }));
  }
  return { ...report, picks };
}

export function readLocaleFromRequest(req: Request): string {
  const url = new URL(req.url);
  const q = url.searchParams.get("locale");
  if (q) return q;
  const accept = req.headers.get("accept-language") ?? "";
  if (accept.toLowerCase().includes("zh")) return "zh";
  return "en";
}
