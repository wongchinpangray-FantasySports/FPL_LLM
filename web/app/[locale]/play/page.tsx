import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { PlayHub } from "@/components/play/play-hub";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function PlayPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "playHub" });

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="4xl"
    >
      <PlayHub />
    </PageShell>
  );
}
