import { PitchView } from "@/components/planner/pitch-view";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getShowcaseRecommendedSquad } from "@/lib/planner/showcase-recommended-squad";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

function HomeShowcaseSquadSkeleton() {
  return (
    <section
      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:rounded-2xl sm:p-6"
      aria-hidden
    >
      <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
      <div className="mt-2 h-3 max-w-xl animate-pulse rounded bg-white/[0.06]" />
      <div className="mt-6 aspect-[5/3.1] max-w-2xl animate-pulse rounded-xl bg-emerald-950/40" />
    </section>
  );
}

async function HomeShowcaseSquadInner() {
  const [data, t, tPlanner] = await Promise.all([
    getShowcaseRecommendedSquad(),
    getTranslations("home"),
    getTranslations("plannerApp"),
  ]);

  if (!data) return null;

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] sm:rounded-2xl sm:p-6 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent/90">
            {t("showcase.eyebrow")}
          </h2>
          <p className="text-lg font-semibold text-white sm:text-xl">
            {t("showcase.title", { gw: data.targetGw })}
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            {t("showcase.subtitle")}
          </p>
        </div>
        <Link href="/planner" className="shrink-0">
          <Button variant="secondary" size="sm" className="w-full sm:w-auto">
            {t("showcase.ctaPlanner")}
          </Button>
        </Link>
      </div>

      <div className="mx-auto mt-6 max-w-xl">
        <PitchView
          title={t("showcase.pitchTitle")}
          caption={t("showcase.pitchCaption", {
            xi: data.xiXpNext.toFixed(1),
            cost: data.squadCost.toFixed(1),
          })}
          benchLabel={tPlanner("pitchBench")}
          benchGkAbbrev={tPlanner("pitchBenchGkAbbrev")}
          picks={data.picks}
          captainId={data.captainId}
          viceId={data.viceId}
          gwForecastByFplId={data.gwForecastByFplId}
          nextGwXpByFplId={data.nextGwXpByFplId}
          nextGwXpTitle={tPlanner("pitchCardNextGwXpTitle", {
            gw: data.targetGw,
          })}
          interactive={false}
        />
      </div>
    </section>
  );
}

export function HomeShowcaseSquad() {
  return (
    <Suspense fallback={<HomeShowcaseSquadSkeleton />}>
      <HomeShowcaseSquadInner />
    </Suspense>
  );
}
