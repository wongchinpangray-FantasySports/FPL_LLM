import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { MiniGameApp } from "@/components/mini/mini-game-app";

export const dynamic = "force-dynamic";

export default async function MiniFantasyPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "miniIndex" });

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="4xl"
    >
      <MiniGameApp locale={locale} />
    </PageShell>
  );
}
