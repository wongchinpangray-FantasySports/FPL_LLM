import type { ScoutTrialStats } from "@/lib/scout/types";

function n(value: number): string {
  return String(value);
}

function monthLabel(iso: string, locale = "en-GB"): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 7);
  }
}

export function buildChrisScorecard(stats: ScoutTrialStats): string {
  const month = monthLabel(stats.from);
  const top = stats.top_articles
    .filter((a) => a.status === "published")
    .slice(0, 3)
    .map((a, i) => `${i + 1}) ${a.title_zh || a.title_en} (${a.pageviews} views)`)
    .join("  ");

  return `Subject: Faleague × FFS China trial — ${month} summary

Hi Chris —

Quick trial update for **${month}**:

### Scout on Faleague
- Scout-attributed posts published: **${n(stats.published_count)}**
- Pageviews on those posts: **${n(stats.pageviews)}** (unique visitors ≈ **${n(stats.unique_visitors)}**)
- Top posts: ${top || "—"}

### Outbound to FFS
- Clicks → FFS Premium: **${n(stats.click_premium + stats.click_qr)}**
- Clicks → Team Rater: **${n(stats.click_team_rater)}**
- Clicks → original Scout articles: **${n(stats.click_original)}**
- (From your side, if visible) Premium / free signups attributed: **N / N**

### Awareness / distribution
- WeChat / XHS pushes with Scout credit: **${n(stats.distribution_count)}**
- Any notable feedback from Chinese managers:

### Faleague Insights Pro (high level only)
- Pro users (end of month): **${n(stats.pro_users)}**
- Positioning unchanged: China-side tools only; not a Scout Members substitute
- Plans next month: soft Pro only; focus remains Scout content + CTAs

### Next month focus
- 

Happy to adjust format if you want different metrics.
Ray`;
}
