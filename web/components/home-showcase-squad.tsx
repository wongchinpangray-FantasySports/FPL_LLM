"use client";

import { PitchView } from "@/components/planner/pitch-view";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ShowcaseRecommendedSquad } from "@/lib/planner/showcase-recommended-squad";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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

/**
 * Loads the home “Best XI” after paint via a cached API route so the home page
 * document stays cheap (avoids Cloudflare Worker CPU limits on the main HTML
 * request). Data matches `getShowcaseRecommendedSquad()` on the server.
 */
export function HomeShowcaseSquad() {
  const t = useTranslations("home");
  const tPlanner = useTranslations("plannerApp");
  const [data, setData] = useState<ShowcaseRecommendedSquad | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/home/showcase", { signal: ac.signal });
        if (!res.ok) {
          setData(null);
          return;
        }
        const json = (await res.json()) as ShowcaseRecommendedSquad | null;
        setData(json);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setData(null);
      }
    })();
    return () => ac.abort();
  }, []);

  if (data === undefined) return <HomeShowcaseSquadSkeleton />;
  if (data === null) return null;

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] sm:rounded-2xl sm:p-6 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {t("showcase.title", { gw: data.targetGw })}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
            {t("showcase.subtitle")}
          </p>
        </div>
        <Link
          href="/planner"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "shrink-0 inline-flex w-full no-underline sm:w-auto",
          )}
        >
          {t("showcase.ctaPlanner")}
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
