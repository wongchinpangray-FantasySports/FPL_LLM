import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FplPreseasonPanel } from "@/components/fpl/fpl-preseason-panel";
import {
  buildPreseasonClubSummaries,
  getPreseasonBundle,
  groupPreseasonByClub,
  type PreseasonMatch,
} from "@/lib/fpl/preseason";
import { loadPreseasonFplPlayerIndex } from "@/lib/fpl/preseason-fpl-players";

/** Bundled JSON — enriched by CI sync / backfill scripts, not at request time. */
export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

function playerLinkKey(plCode: string, name: string): string {
  return `${plCode}:${name.trim()}`;
}

function buildPlayerLinks(
  matches: PreseasonMatch[],
  resolveFplId: (name: string, plCode: string) => number | null,
): Record<string, number> {
  const links: Record<string, number> = {};
  for (const m of matches) {
    for (const g of m.goals) {
      if (g.side !== "pl") continue;
      for (const name of [g.scorer, g.assist].filter(Boolean) as string[]) {
        const key = playerLinkKey(m.pl_code, name);
        if (links[key]) continue;
        const fplId = resolveFplId(name, m.pl_code);
        if (fplId) links[key] = fplId;
      }
    }
    const lineupPlayers = [
      ...(m.lineup?.starters ?? []),
      ...(m.lineup?.subs ?? []),
    ];
    for (const p of lineupPlayers) {
      const key = playerLinkKey(m.pl_code, p.name);
      if (links[key]) continue;
      const fplId = resolveFplId(p.name, m.pl_code);
      if (fplId) links[key] = fplId;
    }
  }
  return links;
}

export default async function FplPreseasonPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplHub",
  });
  const bundle = getPreseasonBundle();
  const clubs = groupPreseasonByClub(bundle.matches);
  const summaries = buildPreseasonClubSummaries(clubs);
  const playerIndex = await loadPreseasonFplPlayerIndex();
  const playerLinks = buildPlayerLinks(
    bundle.matches,
    playerIndex.resolveFplId,
  );

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      title={t("preseasonPageTitle")}
      description={t("preseasonPageDescription")}
      width="6xl"
    >
      <FplPreseasonPanel
        clubs={clubs}
        summaries={summaries}
        locale={params.locale}
        source={bundle.source}
        updatedAt={bundle.updated_at}
        playerLinks={playerLinks}
        labels={{
          upcoming: t("preseasonUpcoming"),
          results: t("preseasonResults"),
          allClubs: t("preseasonAllClubs"),
          vs: t("preseasonVs"),
          noMatches: t("preseasonEmpty"),
          sourceNote: t("preseasonSourceNote"),
          expandClub: t("preseasonExpandClub"),
          tickerUpcoming: t("preseasonTickerUpcoming"),
          tickerResult: t("preseasonTickerResult"),
          kickoffBeijing: t("preseasonKickoffBeijing"),
          kickoffTbd: t("preseasonKickoffTbd"),
          assist: t("preseasonAssist"),
          noGoalDetails: t("preseasonNoGoalDetails"),
          scorersTitle: t("preseasonScorersTitle"),
          assistsTitle: t("preseasonAssistsTitle"),
          leaderboardPlayer: t("preseasonLeaderboardPlayer"),
          leaderboardClub: t("preseasonLeaderboardClub"),
          leaderboardEmpty: t("preseasonLeaderboardEmpty"),
          clubSummaryTitle: t("preseasonClubSummaryTitle"),
          lastResult: t("preseasonLastResult"),
          expandAll: t("preseasonExpandAll"),
          collapseAll: t("preseasonCollapseAll"),
          filterAll: t("preseasonFilterAll"),
          filterResults: t("preseasonFilterResults"),
          filterUpcoming: t("preseasonFilterUpcoming"),
          filterClub: t("preseasonFilterClub"),
          clubStatsTitle: t("preseasonClubStatsTitle"),
          clubStatsEmpty: t("preseasonClubStatsEmpty"),
          lineupTitle: t("preseasonLineupTitle"),
          lineupStarters: t("preseasonLineupStarters"),
          lineupSubs: t("preseasonLineupSubs"),
        }}
      />
    </PageShell>
  );
}
