import type { WcFdrRow, WcPlayerListItem, WcXpRow } from "@/lib/wc/data";
import type { WcScoutingReport } from "@/lib/wc/scouting";
import type { WcMatchGoal, WcMatchRow } from "@/lib/wc/fifa-rounds";
import type { GroupTable, LeaderboardRow, TeamDetail } from "@/lib/wc/standings";
import {
  displayPlayerName,
  isChineseLocale,
  resolveChinesePlayerNameMap,
} from "@/lib/wc/player-names-zh";
import { displayTeamName } from "@/lib/wc/team-names-zh";

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

function localizeMatchTeamNames(m: WcMatchRow, locale: string): WcMatchRow {
  return {
    ...m,
    home_name: displayTeamName(m.home_code, m.home_name, locale),
    away_name: displayTeamName(m.away_code, m.away_name, locale),
  };
}

export function localizeGroupTables(
  groups: GroupTable[],
  locale: string,
): GroupTable[] {
  if (!isChineseLocale(locale)) return groups;
  return groups.map((g) => ({
    ...g,
    rows: g.rows.map((row) => ({
      ...row,
      name: displayTeamName(row.code, row.name, locale),
    })),
  }));
}

export function localizeHomeMatchSnippets<
  T extends {
    home_code: string;
    away_code: string;
    home_name: string;
    away_name: string;
  },
>(snippets: T[], locale: string): T[] {
  if (!isChineseLocale(locale)) return snippets;
  return snippets.map((m) => ({
    ...m,
    home_name: displayTeamName(m.home_code, m.home_name, locale),
    away_name: displayTeamName(m.away_code, m.away_name, locale),
  }));
}

export function localizeFdrGrid(rows: WcFdrRow[], locale: string): WcFdrRow[] {
  if (!isChineseLocale(locale)) return rows;
  return rows.map((row) => ({
    ...row,
    name: displayTeamName(row.code, row.name, locale),
    fixtures: row.fixtures.map((fx) => ({
      ...fx,
      opp_name: displayTeamName(fx.opp_code, fx.opp_name, locale),
    })),
  }));
}

export function localizeTeamsDetail(
  teams: Record<string, TeamDetail>,
  locale: string,
): Record<string, TeamDetail> {
  if (!isChineseLocale(locale)) return teams;
  const out: Record<string, TeamDetail> = {};
  for (const [code, team] of Object.entries(teams)) {
    out[code] = {
      ...team,
      name: displayTeamName(code, team.name, locale),
      standing: team.standing
        ? {
            ...team.standing,
            name: displayTeamName(code, team.standing.name, locale),
          }
        : null,
      results: team.results.map((r) => ({
        ...r,
        opponent_name: displayTeamName(
          r.opponent_code,
          r.opponent_name,
          locale,
        ),
      })),
    };
  }
  return out;
}

export async function localizeWcMatches(
  matches: WcMatchRow[],
  locale: string,
): Promise<WcMatchRow[]> {
  if (!isChineseLocale(locale)) return matches;
  const zhMap = await resolveChinesePlayerNameMap(collectNamesFromMatches(matches));
  return matches.map((m) => {
    const withTeams = localizeMatchTeamNames(m, locale);
    return {
      ...withTeams,
      home_goals: withTeams.home_goals.map((g) => localizeGoal(g, locale, zhMap)),
      away_goals: withTeams.away_goals.map((g) => localizeGoal(g, locale, zhMap)),
      home_cards: withTeams.home_cards.map((c) => ({
        ...c,
        player_display: displayPlayerName(
          c.player_display || c.player,
          locale,
          zhMap,
        ),
      })),
      away_cards: withTeams.away_cards.map((c) => ({
        ...c,
        player_display: displayPlayerName(
          c.player_display || c.player,
          locale,
          zhMap,
        ),
      })),
    };
  });
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
    team_name: displayTeamName(r.team_code, r.team_name, locale),
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

export async function localizeWcPlayerRows<
  T extends { name: string; team_code: string; team_name: string },
>(rows: T[], locale: string): Promise<T[]> {
  if (!isChineseLocale(locale)) return rows;
  const zhMap = await resolveChinesePlayerNameMap(rows.map((r) => r.name));
  return rows.map((r) => ({
    ...r,
    name: displayPlayerName(r.name, locale, zhMap),
    team_name: displayTeamName(r.team_code, r.team_name, locale),
  }));
}

export async function localizeXpRows(
  rows: WcXpRow[],
  locale: string,
): Promise<WcXpRow[]> {
  const localized = await localizeWcPlayerRows(rows, locale);
  if (!isChineseLocale(locale)) return localized;
  return localized.map((r) => ({
    ...r,
    byMd: Object.fromEntries(
      Object.entries(r.byMd).map(([md, cell]) => [
        md,
        {
          ...cell,
          opp_name: displayTeamName(cell.opp, cell.opp_name, locale),
        },
      ]),
    ),
  }));
}

export async function localizePlayerListItems(
  rows: WcPlayerListItem[],
  locale: string,
): Promise<WcPlayerListItem[]> {
  return localizeWcPlayerRows(rows, locale);
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
      team_name: displayTeamName(p.team_code, p.team_name, locale),
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
