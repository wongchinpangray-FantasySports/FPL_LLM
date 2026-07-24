import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { WcMiniGameApp } from "@/components/wc-mini/wc-mini-game-app";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function PlayWcMiniPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "wcMiniIndex" });
  const common = await getTranslations({ locale: params.locale, namespace: "common" });

  return (
    <PageShell
      backHref="/"
      backLabel={common("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="4xl"
    >
      <WcMiniGameApp locale={params.locale} />
    </PageShell>
  );
}
