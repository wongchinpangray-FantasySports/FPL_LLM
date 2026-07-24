import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { HomeBackLink } from "@/components/home-back-link";
import { SquadBuilderApp } from "@/components/squad-builder/squad-builder-app";
import { listCurrentPlTeams } from "@/lib/fpl/epl-2627-clubs";
import { resolvePlannerProjectionWindow } from "@/lib/planner/projection-window";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function SquadBuilderPage({ params }: Props) {
  setRequestLocale(params.locale);
  const common = await getTranslations({
    locale: params.locale,
    namespace: "common",
  });
  const [teams, window] = await Promise.all([
    listCurrentPlTeams(),
    resolvePlannerProjectionWindow(5),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 pb-8 md:gap-6">
      <HomeBackLink label={common("backHome")} />
      <SquadBuilderApp
        teams={teams}
        gwContext={{
          currentGw: window.currentGw,
          fromGw: window.fromGw,
          toGw: window.toGw,
        }}
      />
    </div>
  );
}
