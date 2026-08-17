import preseasonData from "@/data/epl-preseason-2627.json";
import { getEpl2627Season } from "@/lib/fpl/epl-2627";
import type { PreseasonGoal } from "@/lib/fpl/preseason-enrich";
import { enrichPreseasonMatchesFromSources } from "@/lib/fpl/preseason-enrich";
import { needsPreseasonGoalFetch } from "@/lib/fpl/preseason-scorers";

export type { PreseasonGoal };

export type PreseasonLineupPlayer = {
  name: string;
  number?: number | null;
  minute_on?: number | null;
};

export type PreseasonLineup = {
  formation: string | null;
  starters: PreseasonLineupPlayer[];
  subs: PreseasonLineupPlayer[];
};

export type PreseasonMatch = {
  id: string;
  date: string;
  pl_code: string;
  pl_name: string;
  opponent: string;
  pl_home: boolean;
  venue: string | null;
  note: string | null;
  status: "finished" | "scheduled";
  pl_goals: number | null;
  opp_goals: number | null;
  kickoff_time: string | null;
  goals: PreseasonGoal[];
  lineup?: PreseasonLineup | null;
};

export type PreseasonBundle = {
  season: string;
  source: string;
  updated_at: string;
  matches: PreseasonMatch[];
};

export type PreseasonClubGroup = {
  code: string;
  name: string;
  matches: PreseasonMatch[];
};

export type PreseasonClubSummary = {
  code: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  /** Chronological finished results (oldest → newest). */
  form: Array<"W" | "D" | "L">;
  upcomingCount: number;
  lastMatch: PreseasonMatch | null;
  topScorers: Array<{ name: string; count: number }>;
  topAssists: Array<{ name: string; count: number }>;
  /** All friendlies for this club, chronological. */
  matches: PreseasonMatch[];
};

function resultLetter(m: PreseasonMatch): "W" | "D" | "L" | null {
  if (m.status !== "finished") return null;
  if (m.pl_goals == null || m.opp_goals == null) return null;
  if (m.pl_goals > m.opp_goals) return "W";
  if (m.pl_goals < m.opp_goals) return "L";
  return "D";
}

function topStatRows(
  matches: PreseasonMatch[],
  kind: "scorer" | "assist",
  limit = 8,
): Array<{ name: string; count: number }> {
  const map = new Map<string, { name: string; count: number }>();
  for (const m of matches) {
    if (m.status !== "finished") continue;
    for (const g of m.goals ?? []) {
      if (g.side !== "pl") continue;
      const raw = kind === "scorer" ? g.scorer : g.assist;
      if (!raw?.trim()) continue;
      const name = raw.trim();
      const key = normPreseasonPlayerName(name);
      const prev = map.get(key);
      if (prev) {
        prev.count += 1;
        if (name.length > prev.name.length) prev.name = name;
      } else {
        map.set(key, { name, count: 1 });
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function buildPreseasonClubSummaries(
  clubs: PreseasonClubGroup[],
): PreseasonClubSummary[] {
  return clubs
    .map((group) => {
      const chronological = [...group.matches].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      let played = 0;
      let won = 0;
      let drawn = 0;
      let lost = 0;
      let gf = 0;
      let ga = 0;
      let lastMatch: PreseasonMatch | null = null;
      const form: Array<"W" | "D" | "L"> = [];
      let upcomingCount = 0;

      for (const m of chronological) {
        if (m.status === "scheduled") {
          upcomingCount += 1;
          continue;
        }
        if (m.pl_goals == null || m.opp_goals == null) continue;
        played += 1;
        gf += m.pl_goals;
        ga += m.opp_goals;
        const letter = resultLetter(m);
        if (letter === "W") won += 1;
        else if (letter === "L") lost += 1;
        else if (letter === "D") drawn += 1;
        if (letter) form.push(letter);
        lastMatch = m;
      }

      return {
        code: group.code,
        name: group.name,
        played,
        won,
        drawn,
        lost,
        gf,
        ga,
        form,
        upcomingCount,
        lastMatch,
        topScorers: topStatRows(chronological, "scorer"),
        topAssists: topStatRows(chronological, "assist"),
        matches: chronological,
      };
    })
    .filter((s) => s.played > 0 || s.upcomingCount > 0 || s.matches.length > 0)
    .sort((a, b) => {
      const pts = (s: PreseasonClubSummary) => s.won * 3 + s.drawn;
      const d = pts(b) - pts(a);
      if (d !== 0) return d;
      const gd = b.gf - b.ga - (a.gf - a.ga);
      if (gd !== 0) return gd;
      return a.name.localeCompare(b.name);
    });
}

const rawBundle = preseasonData as Omit<PreseasonBundle, "matches"> & {
  matches: Array<
    Omit<PreseasonMatch, "kickoff_time" | "goals" | "lineup"> & {
      kickoff_time?: string | null;
      goals?: PreseasonGoal[];
      lineup?: PreseasonLineup | null;
    }
  >;
};

function normalizeMatch(
  m: (typeof rawBundle.matches)[number],
): PreseasonMatch {
  return {
    ...m,
    kickoff_time: m.kickoff_time ?? null,
    goals: m.goals ?? [],
    lineup: m.lineup ?? null,
  };
}

export function getPreseasonBundle(): PreseasonBundle {
  return {
    ...rawBundle,
    matches: rawBundle.matches.map(normalizeMatch),
  };
}

function londonTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addLondonDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Enrich only finished matches still missing scorer rows (not kickoff/score sync). */
export async function loadPreseasonBundle(): Promise<PreseasonBundle> {
  const base = getPreseasonBundle();
  const stale = base.matches.filter(
    (m) => m.status === "finished" && needsPreseasonGoalFetch(m),
  );
  if (stale.length === 0) return base;

  const enriched = await enrichPreseasonMatchesFromSources(stale);
  const byId = new Map(enriched.map((m) => [m.id, m as PreseasonMatch]));
  return {
    ...base,
    matches: base.matches.map((m) => byId.get(m.id) ?? m),
  };
}

export function groupPreseasonByClub(
  matches: PreseasonMatch[],
): PreseasonClubGroup[] {
  const teamOrder = getEpl2627Season().teams.map((t) => t.code);
  const byCode = new Map<string, PreseasonClubGroup>();

  for (const code of teamOrder) {
    const team = getEpl2627Season().teams.find((t) => t.code === code);
    if (!team) continue;
    byCode.set(code, { code, name: team.name, matches: [] });
  }

  for (const match of matches) {
    const group = byCode.get(match.pl_code);
    if (group) {
      group.matches.push(match);
    } else {
      byCode.set(match.pl_code, {
        code: match.pl_code,
        name: match.pl_name,
        matches: [match],
      });
    }
  }

  return [...byCode.values()].filter((g) => g.matches.length > 0);
}

export function splitPreseasonMatches(matches: PreseasonMatch[]): {
  upcoming: PreseasonMatch[];
  results: PreseasonMatch[];
} {
  const upcoming: PreseasonMatch[] = [];
  const results: PreseasonMatch[] = [];
  for (const m of matches) {
    const hasScore = m.pl_goals != null && m.opp_goals != null;
    if (m.status === "finished" || hasScore) results.push(m);
    else upcoming.push(m);
  }
  upcoming.sort((a, b) => {
    const ka = a.kickoff_time ?? `${a.date}T12:00:00Z`;
    const kb = b.kickoff_time ?? `${b.date}T12:00:00Z`;
    return ka.localeCompare(kb);
  });
  results.sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, results };
}

export function formatPreseasonDate(date: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}

export function formatPreseasonKickoffBeijing(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `${get("month")} ${get("day")}, ${get("hour")}:${get("minute")}`;
  } catch {
    return null;
  }
}

export function formatPreseasonScore(match: PreseasonMatch): string | null {
  if (match.status !== "finished") return null;
  if (match.pl_goals == null || match.opp_goals == null) return null;
  if (match.pl_home) {
    return `${match.pl_goals}–${match.opp_goals}`;
  }
  return `${match.opp_goals}–${match.pl_goals}`;
}

export function preseasonOpponentLabel(match: PreseasonMatch): string {
  return match.opponent;
}

export function preseasonVenueLabel(match: PreseasonMatch): string | null {
  if (match.venue) return match.venue;
  if (match.note && !match.note.toLowerCase().includes("closed")) {
    return match.note;
  }
  return null;
}

export type PreseasonLeaderboardRow = {
  key: string;
  name: string;
  pl_code: string;
  pl_name: string;
  count: number;
};

export function normPreseasonPlayerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function pickDisplayName(current: string, next: string): string {
  if (!current) return next;
  if (next.length > current.length) return next;
  return current;
}

export function buildPreseasonLeaderboards(matches: PreseasonMatch[]): {
  scorers: PreseasonLeaderboardRow[];
  assists: PreseasonLeaderboardRow[];
} {
  const scorerMap = new Map<string, PreseasonLeaderboardRow>();
  const assistMap = new Map<string, PreseasonLeaderboardRow>();

  for (const match of matches) {
    if (match.status !== "finished") continue;
    for (const goal of match.goals) {
      if (goal.side !== "pl") continue;

      const scorerKey = `${match.pl_code}:${normPreseasonPlayerName(goal.scorer)}`;
      const scorerRow = scorerMap.get(scorerKey);
      if (scorerRow) {
        scorerRow.count += 1;
        scorerRow.name = pickDisplayName(scorerRow.name, goal.scorer);
      } else {
        scorerMap.set(scorerKey, {
          key: scorerKey,
          name: goal.scorer,
          pl_code: match.pl_code,
          pl_name: match.pl_name,
          count: 1,
        });
      }

      const assistName = goal.assist?.trim();
      if (!assistName) continue;

      const assistKey = `${match.pl_code}:${normPreseasonPlayerName(assistName)}`;
      const assistRow = assistMap.get(assistKey);
      if (assistRow) {
        assistRow.count += 1;
        assistRow.name = pickDisplayName(assistRow.name, assistName);
      } else {
        assistMap.set(assistKey, {
          key: assistKey,
          name: assistName,
          pl_code: match.pl_code,
          pl_name: match.pl_name,
          count: 1,
        });
      }
    }
  }

  const sortRows = (rows: PreseasonLeaderboardRow[]) =>
    rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    scorers: sortRows([...scorerMap.values()]),
    assists: sortRows([...assistMap.values()]),
  };
}
