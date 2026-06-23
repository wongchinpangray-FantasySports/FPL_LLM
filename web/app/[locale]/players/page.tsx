import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { PlayerProfileSearch } from "@/components/player/player-profile-search";

export const dynamic = "force-dynamic";

export default async function PlayersSearchPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "playersIndex" });

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="6xl"
    >
      <PlayerProfileSearch />
    </PageShell>
  );
}
