import type { BracketMatch } from "@/lib/wc/knockout-bracket";

const SHANGHAI = "Asia/Shanghai";

export function formatBracketKickoff(
  iso: string | null | undefined,
  locale: string,
): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  if (locale.toLowerCase().startsWith("zh")) {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: SHANGHAI,
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    const hour = parts.find((p) => p.type === "hour")?.value ?? "";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "";
    return { date: `${month}月${day}日`, time: `${hour}:${minute}` };
  }

  return {
    date: d.toLocaleDateString(locale, { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
  };
}

export function hasPenaltyShootout(match: BracketMatch): boolean {
  return (
    match.homePenalty != null &&
    match.awayPenalty != null &&
    match.homePenalty !== match.awayPenalty
  );
}

/** Xiaohongshu-style shootout line, e.g. 1(3)-(4)1 */
export function formatPenaltyLine(match: BracketMatch): string | null {
  if (!hasPenaltyShootout(match)) return null;
  if (match.homeScore == null || match.awayScore == null) return null;
  return `${match.homeScore}(${match.homePenalty})-(${match.awayPenalty})${match.awayScore}`;
}
