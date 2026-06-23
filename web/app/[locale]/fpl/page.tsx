import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FplHub } from "@/components/fpl/fpl-hub";

type Props = { params: { locale: string } };

export default async function FplPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplHub" });

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      title={t("title")}
      description={t("description")}
      width="6xl"
    >
      <FplHub />
    </PageShell>
  );
}
