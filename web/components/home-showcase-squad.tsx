import { PitchView } from "@/components/planner/pitch-view";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ShowcaseRecommendedSquad } from "@/lib/planner/showcase-recommended-squad";

export type HomeShowcaseSquadProps = {
  data: ShowcaseRecommendedSquad;
  title: string;
  subtitle: string;
  ctaPlanner: string;
  pitchTitle: string;
  pitchCaption: string;
  benchLabel: string;
  benchGkAbbrev: string;
  nextGwXpTitle: string;
};

/**
 * Best XI block for the home page. Data must be loaded in `page.tsx` and passed in
 * so the route does not use a nested async + Suspense boundary (reduces RSC
 * “Connection closed” failures on slow networks / some CDNs).
 */
export function HomeShowcaseSquad({
  data,
  title,
  subtitle,
  ctaPlanner,
  pitchTitle,
  pitchCaption,
  benchLabel,
  benchGkAbbrev,
  nextGwXpTitle,
}: HomeShowcaseSquadProps) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] sm:rounded-2xl sm:p-6 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {title}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            {subtitle}
          </p>
        </div>
        <Link
          href="/planner"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "shrink-0 inline-flex w-full no-underline sm:w-auto",
          )}
        >
          {ctaPlanner}
        </Link>
      </div>

      <div className="mx-auto mt-6 max-w-xl">
        <PitchView
          title={pitchTitle}
          caption={pitchCaption}
          benchLabel={benchLabel}
          benchGkAbbrev={benchGkAbbrev}
          picks={data.picks}
          captainId={data.captainId}
          viceId={data.viceId}
          gwForecastByFplId={data.gwForecastByFplId}
          nextGwXpByFplId={data.nextGwXpByFplId}
          nextGwXpTitle={nextGwXpTitle}
          interactive={false}
        />
      </div>
    </section>
  );
}
