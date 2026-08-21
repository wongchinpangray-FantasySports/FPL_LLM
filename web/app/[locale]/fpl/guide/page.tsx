import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FplBeginnerGuide } from "@/components/fpl/fpl-beginner-guide";

type Props = { params: { locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "fplGuide" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function FplGuidePage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplGuide" });

  return (
    <PageShell
      backHref="/fpl"
      backLabel={t("backFpl")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="6xl"
      className="[&_header_h1]:text-2xl [&_header_h1]:sm:text-3xl [&_header_p]:text-base [&_header_p]:leading-relaxed"
    >
      <FplBeginnerGuide
        labels={{
          tocTitle: t("tocTitle"),
          officialRules: t("officialRules"),
          officialRulesLink: t("officialRulesLink"),
          toolsTitle: t("toolsTitle"),
          recommendedSquad: t("recommendedSquad"),
          recommendedSquadBody: t("recommendedSquadBody"),
          squadBuilder: t("squadBuilder"),
          squadBuilderBody: t("squadBuilderBody"),
          fixtures: t("fixtures"),
          fixturesBody: t("fixturesBody"),
          ffScout: t("ffScout"),
          ffScoutBody: t("ffScoutBody"),
          ffScoutNote: t("ffScoutNote"),
          ffScoutScoutLink: t("ffScoutScoutLink"),
          tableAction: t("tableAction"),
          tablePoints: t("tablePoints"),
          note: t("note"),
          updatedNote: t("updatedNote"),
        }}
      />
    </PageShell>
  );
}
