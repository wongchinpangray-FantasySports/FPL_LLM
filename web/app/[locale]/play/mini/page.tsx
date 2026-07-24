import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { MiniGameApp } from "@/components/mini/mini-game-app";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function PlayMiniFplPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "miniIndex" });

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="4xl"
    >
      <MiniGameApp locale={params.locale} />
    </PageShell>
  );
}
