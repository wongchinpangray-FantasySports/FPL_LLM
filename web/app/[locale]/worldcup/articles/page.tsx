import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { buildWcMatchesWithStats } from "@/lib/wc/match-stats-store";
import { canWriteMatchArticle, articleKindForMatch } from "@/lib/wc/match-article";
import { roundLabelForLocale } from "@/lib/wc/match-enrichment";
import { displayTeamName } from "@/lib/wc/team-names-zh";
import { WcArticlesList } from "@/components/worldcup/wc-articles-list";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function WcArticlesPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "worldcup" });
  const { matches } = await buildWcMatchesWithStats();

  const articles = matches
    .filter(canWriteMatchArticle)
    .map((m) => ({
      id: m.id,
      home: displayTeamName(m.home_code, m.home_name, params.locale),
      away: displayTeamName(m.away_code, m.away_name, params.locale),
      home_code: m.home_code,
      away_code: m.away_code,
      score:
        m.home_score != null && m.away_score != null
          ? `${m.home_score}-${m.away_score}`
          : null,
      kickoff: m.kickoff,
      round_label: roundLabelForLocale(m, params.locale.startsWith("zh") ? "zh" : "en"),
      kind: articleKindForMatch(m),
      featured:
        (m.home_code === "ENG" && m.away_code === "GHA") ||
        (m.home_code === "GHA" && m.away_code === "ENG"),
    }))
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      const ak = a.kickoff ?? "";
      const bk = b.kickoff ?? "";
      return bk.localeCompare(ak);
    });

  return (
    <PageShell
      backHref="/worldcup"
      backLabel={t("articlesBackWorldCup")}
      eyebrow={t("articlesEyebrow")}
      title={t("articlesPageTitle")}
      description={t("articlesPageDescription")}
      width="2xl"
    >
      <WcArticlesList
        matches={articles}
        labels={{
          featured: t("articlesFeatured"),
          read: t("articlesRead"),
          preview: t("articlesPreviewBadge"),
          report: t("articlesReportBadge"),
          empty: t("articlesEmpty"),
        }}
      />
    </PageShell>
  );
}
