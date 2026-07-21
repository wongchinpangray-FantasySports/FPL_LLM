import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { WcFantasyApp } from "@/components/worldcup/wc-fantasy-app";

/** Bracket/context load client-side — avoids FIFA SSR on Workers. */
export const dynamic = "force-static";
export const revalidate = 120;

export default async function WorldCupPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "worldcupIndex" });

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="6xl"
    >
      <WcFantasyApp />
    </PageShell>
  );
}
