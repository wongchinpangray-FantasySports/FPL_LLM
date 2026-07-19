import preseasonData from "@/data/epl-preseason-2627.json";
import { getEpl2627Season } from "@/lib/fpl/epl-2627";

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

const bundle = preseasonData as PreseasonBundle;

export function getPreseasonBundle(): PreseasonBundle {
  return bundle;
}

export function getPreseasonMatches(): PreseasonMatch[] {
  return bundle.matches;
}

export function groupPreseasonByClub(): PreseasonClubGroup[] {
  const teamOrder = getEpl2627Season().teams.map((t) => t.code);
  const byCode = new Map<string, PreseasonClubGroup>();

  for (const code of teamOrder) {
    const team = getEpl2627Season().teams.find((t) => t.code === code);
    if (!team) continue;
    byCode.set(code, { code, name: team.name, matches: [] });
  }

  for (const match of bundle.matches) {
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
    if (m.status === "finished") results.push(m);
    else upcoming.push(m);
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  results.sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, results };
}

export function formatPreseasonDate(date: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
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
  const parts = [match.opponent];
  if (match.venue) parts.push(`(${match.venue})`);
  return parts.join(" ");
}
