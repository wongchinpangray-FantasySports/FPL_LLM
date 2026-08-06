import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { BestOfPositionSeriesNav } from "@/components/fpl/insights/best-of-position-series-nav";
import { ValueBandPanel } from "@/components/fpl/insights/value-band-panel";
import {
  VALUE_BAND_PRESETS,
  formatValueBandPrice,
  getValueBandPreset,
  loadValueBandByPresetCached,
  type ValueBandPosition,
} from "@/lib/fpl/insights/value-bands";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string; band: string } };

const POS_KEY: Record<ValueBandPosition, string> = {
  GKP: "posGKP",
  DEF: "posDEF",
  MID: "posMID",
  FWD: "posFWD",
};

const POS_SHORT_KEY: Record<ValueBandPosition, string> = {
  GKP: "posShortGKP",
  DEF: "posShortDEF",
  MID: "posShortMID",
  FWD: "posShortFWD",
};

export function generateStaticParams() {
  return VALUE_BAND_PRESETS.map((p) => ({ band: p.id }));
}

export default async function BestOfPositionBandPage({ params }: Props) {
  setRequestLocale(params.locale);
  const preset = getValueBandPreset(params.band);
  if (!preset) notFound();

  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplInsights",
  });
  const data = await loadValueBandByPresetCached(preset.id);
  if (!data) notFound();

  const price = formatValueBandPrice(preset.minPrice);
  const position = t(
    `bestOfPosition.${POS_KEY[preset.position]}` as "bestOfPosition.posMID",
  );
  const positionShort = t(
    `bestOfPosition.${POS_SHORT_KEY[preset.position]}` as "bestOfPosition.posShortMID",
  );

  const title = t("bestOfPosition.bandTitle", { price, position });
  const description = t("bestOfPosition.bandDescription", {
    price,
    position,
  });

  return (
    <PageShell
      backHref="/fpl/insights/best-of-position"
      backLabel={t("bestOfPosition.backSeries")}
      title={title}
      description={description}
      width="6xl"
    >
      <InsightsSubNav />
      <div className="mt-4 flex flex-col gap-5">
        <BestOfPositionSeriesNav
          currentId={preset.id}
          activePosition={preset.position}
        />
        <ValueBandPanel
          rows={data.rows}
          takeaways={data.takeaways}
          assessed={data.assessed}
          horizon={data.horizon}
          locale={params.locale}
          labels={{
            intro: t("bestOfPosition.intro", {
              n: data.assessed,
              horizon: data.horizon,
              price,
              position,
            }),
            takeawaysTitle: t("bestOfPosition.takeawaysTitle"),
            assessed: t("bestOfPosition.assessed", { n: data.assessed }),
            colPlayer: t("bestOfPosition.colPlayer"),
            colTeam: t("bestOfPosition.colTeam"),
            colPrice: t("bestOfPosition.colPrice"),
            colOwn: t("bestOfPosition.colOwn"),
            colXp: t("bestOfPosition.colXp"),
            colMins: t("bestOfPosition.colMins"),
            colThreat: t("bestOfPosition.colThreat"),
            colDefcon90: t("bestOfPosition.colDefcon90"),
            colPreG: t("bestOfPosition.colPreG"),
            colValue: t("bestOfPosition.colValue"),
            colProfile: t("bestOfPosition.colProfile"),
            profileLink: t("bestOfPosition.profileLink"),
            empty: t("bestOfPosition.empty", { price, position: positionShort }),
          }}
        />
      </div>
    </PageShell>
  );
}

export async function generateMetadata({ params }: Props) {
  const preset = getValueBandPreset(params.band);
  if (!preset) return {};
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplInsights",
  });
  const price = formatValueBandPrice(preset.minPrice);
  const position = t(
    `bestOfPosition.${POS_KEY[preset.position]}` as "bestOfPosition.posMID",
  );
  return {
    title: t("bestOfPosition.bandTitle", { price, position }),
    description: t("bestOfPosition.bandDescription", { price, position }),
  };
}
