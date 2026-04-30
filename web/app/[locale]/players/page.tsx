import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
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
    <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-8">
      <div>
        <Link
          href="/"
          className="text-sm text-slate-400 transition-colors hover:text-brand-accent"
        >
          {t("backHome")}
        </Link>
      </div>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <PlayerProfileSearch />
    </div>
  );
}
