import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { WcFantasyApp } from "@/components/worldcup/wc-fantasy-app";
import { loadKnockoutBracket } from "@/lib/wc/load-knockout-bracket";

export const dynamic = "force-dynamic";

export default async function WorldCupPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const [t, initialBracket] = await Promise.all([
    getTranslations({ locale, namespace: "worldcupIndex" }),
    loadKnockoutBracket(locale),
  ]);

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="6xl"
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <WcFantasyApp initialBracket={initialBracket} />
      </Suspense>
    </PageShell>
  );
}
