import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import type { InsightsMeta } from "@/lib/fpl/insights/types";

async function loadInsightsMetaRaw(): Promise<InsightsMeta> {
  const season = await getCurrentFplSeason();
  const seasonEnd = String(Number(season) + 1).slice(-2);
  const seasonLabel = `${season}/${seasonEnd}`;

  const supa = getServerSupabase();
  const [{ data: gws }, { data: syncRow }] = await Promise.all([
    supa
      .from("gameweeks")
      .select("id,is_current,is_next,deadline_time,finished")
      .order("id"),
    supa
      .from("players_static")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const current = gws?.find((g) => g.is_current) ?? null;
  const next = gws?.find((g) => g.is_next) ?? null;
  const submissionGw = next ?? current;

  return {
    season,
    seasonLabel,
    currentGw: current?.id ?? null,
    nextGw: next?.id ?? null,
    submissionOpen: Boolean(submissionGw && !submissionGw.finished),
    deadlineTime: (submissionGw?.deadline_time as string | null) ?? null,
    updatedAt: (syncRow?.updated_at as string | null) ?? null,
  };
}

export const loadInsightsMeta = unstable_cache(
  loadInsightsMetaRaw,
  ["fpl-insights-meta-v1"],
  { revalidate: 120 },
);
