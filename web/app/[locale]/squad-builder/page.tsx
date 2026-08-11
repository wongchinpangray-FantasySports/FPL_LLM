import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { HomeBackLink } from "@/components/home-back-link";
import {
  SquadBuilderApp,
  type SquadBuilderInitialImport,
} from "@/components/squad-builder/squad-builder-app";
import { listCurrentPlTeams } from "@/lib/fpl/epl-2627-clubs";
import { resolveSquadBuilderWindow } from "@/lib/squad-builder/projection-window";
import { getOfficialFplBrowsePlayers } from "@/lib/squad-builder/fpl-live-players";
import {
  parseSquadBuilderImportParams,
  picksFromBrowsePlayers,
} from "@/lib/squad-builder/import-ids";

export const dynamic = "force-dynamic";

type Props = {
  params: { locale: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function SquadBuilderPage({ params, searchParams }: Props) {
  setRequestLocale(params.locale);
  const common = await getTranslations({
    locale: params.locale,
    namespace: "common",
  });
  const [teams, window, browse] = await Promise.all([
    listCurrentPlTeams(),
    resolveSquadBuilderWindow(5),
    getOfficialFplBrowsePlayers(),
  ]);

  let initialImport: SquadBuilderInitialImport | null = null;
  const parsed = parseSquadBuilderImportParams(searchParams ?? {});
  if (parsed) {
    const byId = new Map(browse.map((p) => [p.fpl_id, p]));
    const picks = picksFromBrowsePlayers(parsed.ids, byId, {
      captainId: parsed.captainId,
      viceId: parsed.viceId,
    });
    const filled = picks.filter((p) => p.fpl_id > 0).length;
    if (filled === 15) {
      initialImport = {
        picks,
        captainId: parsed.captainId,
        viceId: parsed.viceId,
        draftIndex: parsed.draft,
      };
    }
  }

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
        initialImport={initialImport}
      />
    </div>
  );
}
