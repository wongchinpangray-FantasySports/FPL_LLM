import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { HomeBackLink } from "@/components/home-back-link";
import { SquadBuilderApp } from "@/components/squad-builder/squad-builder-app";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function SquadBuilderPage({ params }: Props) {
  setRequestLocale(params.locale);
  const common = await getTranslations({
    locale: params.locale,
    namespace: "common",
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8 md:gap-6">
      <HomeBackLink label={common("backHome")} />
      <SquadBuilderApp />
    </div>
  );
}
