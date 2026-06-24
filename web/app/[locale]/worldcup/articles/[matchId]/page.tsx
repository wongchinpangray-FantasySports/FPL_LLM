import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { WcArticleReader } from "@/components/worldcup/wc-article-reader";
import { buildWcMatchesWithStats } from "@/lib/wc/match-stats-store";
import { canWriteMatchArticle } from "@/lib/wc/match-article";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string; matchId: string } };

export default async function WcArticlePage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "worldcup" });
  const matchId = Number(params.matchId);
  if (!Number.isFinite(matchId) || matchId <= 0) notFound();

  const { matches } = await buildWcMatchesWithStats();
  const match = matches.find((m) => m.id === matchId);
  if (!match || !canWriteMatchArticle(match)) notFound();

  return (
    <PageShell
      backHref="/worldcup/articles"
      backLabel={t("articlesBackList")}
      width="2xl"
    >
      <WcArticleReader
        matchId={matchId}
        locale={params.locale}
        labels={{
          loading: t("articlesLoading"),
          error: t("articlesError"),
          back: t("articlesBackList"),
          previewBadge: t("articlesPreviewBadge"),
          reportBadge: t("articlesReportBadge"),
          sourceAi: t("articlesSourceAi"),
          sourceTemplate: t("articlesSourceTemplate"),
        }}
      />
    </PageShell>
  );
}
