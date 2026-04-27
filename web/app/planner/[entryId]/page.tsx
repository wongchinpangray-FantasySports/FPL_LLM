import Link from "next/link";
import { notFound } from "next/navigation";
import { PlannerApp } from "@/components/planner/planner-app";
import { getServerSupabase } from "@/lib/supabase";
import {
  fetchAndCacheTeam,
  isFreeHitOnPicksGw,
} from "@/lib/tools/team";

export const dynamic = "force-dynamic";

export default async function PlannerPage({
  params,
  searchParams,
}: {
  params: { entryId: string };
  searchParams?: { squad?: string; refresh?: string };
}) {
  const entryId = Number(params.entryId);
  if (!Number.isFinite(entryId) || entryId <= 0) notFound();

  const useFreeHitSquad = searchParams?.squad === "freehit";
  const forceRefresh =
    searchParams?.refresh === "1" || searchParams?.refresh === "true";

  let team;
  try {
    team = await fetchAndCacheTeam(entryId, { forceRefresh });
  } catch (err) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">
          Couldn&apos;t load team
        </h1>
        <p className="mt-2 text-sm text-rose-100/90">
          {(err as Error).message}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-brand-accent hover:bg-white/10"
        >
          ← Home
        </Link>
      </div>
    );
  }

  const hasRevert = Boolean(team.long_team_picks?.length);
  const freeHitContext = isFreeHitOnPicksGw(
    team.active_chip,
    team.picks_gw,
    team.chips_used ?? [],
  );
  const sourcePicks =
    useFreeHitSquad || !hasRevert
      ? team.picks
      : team.long_team_picks!;

  const ids = sourcePicks.map((p) => p.fpl_id);
  const supa = getServerSupabase();
  const { data: rows } = await supa
    .from("players_static")
    .select("fpl_id,team_id")
    .in("fpl_id", ids);

  const tidById = new Map<number, number>();
  for (const r of rows ?? []) {
    tidById.set(r.fpl_id as number, r.team_id as number);
  }

  const initialPicks = [...sourcePicks]
    .sort((a, b) => a.slot - b.slot)
    .map((p) => ({
      slot: p.slot,
      fpl_id: p.fpl_id,
      web_name: p.web_name,
      team: p.team,
      team_id: tidById.get(p.fpl_id) ?? null,
      position: p.position,
      base_price: p.price,
      is_starter: p.is_starter,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
    }));

  let baselineBanner: string | null = null;
  if (freeHitContext) {
    if (hasRevert) {
      baselineBanner = useFreeHitSquad
        ? `Showing your temporary Free Hit 15 (GW${team.picks_gw ?? "?"}). ` +
          `To plan with the squad you revert to after the Free Hit, open ` +
          `planner without ?squad=freehit.`
        : (team.long_team_note ??
          `Using your GW${team.long_team_gw} squad (revert team after Free Hit). ` +
            `Add ?squad=freehit to the URL to see the Free Hit 15.`);
    } else {
      baselineBanner =
        `Free Hit is active on GW${team.picks_gw ?? "?"}. The pitch below is your temporary 15. ` +
        `We could not load your revert squad from GW${(team.picks_gw ?? 1) - 1}. ` +
        `Try again with ?refresh=1 or after the player DB sync job runs.`;
    }
  }

  return (
    <PlannerApp
      entryId={entryId}
      entryName={team.entry.name}
      initialBank={team.bank}
      initialPicks={initialPicks}
      baselineBanner={baselineBanner}
      squadToggle={
        hasRevert
          ? {
              useFreeHit: useFreeHitSquad,
              pathBase: `/planner/${entryId}`,
            }
          : null
      }
    />
  );
}
