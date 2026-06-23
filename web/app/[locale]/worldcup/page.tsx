import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { WcFantasyApp } from "@/components/worldcup/wc-fantasy-app";

export const dynamic = "force-dynamic";

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
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <WcFantasyApp />
      </Suspense>
    </PageShell>
  );
}
