import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { PlannerApp } from "@/components/planner/planner-app";
import { getServerSupabase } from "@/lib/supabase";
import { fetchTeamForUi, isFreeHitOnPicksGw } from "@/lib/tools/team";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlannerPage({
  params,
  searchParams,
}: {
  params: { locale: string; entryId: string };
  searchParams?: { squad?: string; refresh?: string };
}) {
  const entryId = Number(params.entryId);
  if (!Number.isFinite(entryId) || entryId <= 0) notFound();

  setRequestLocale(params.locale);

  const pt = await getTranslations({
    locale: params.locale,
    namespace: "planner",
  });
  const fb = await getTranslations({
    locale: params.locale,
    namespace: "fhBanner",
  });

  const useFreeHitSquad = searchParams?.squad === "freehit";
  const forceRefresh =
    searchParams?.refresh === "1" || searchParams?.refresh === "true";

  let team;
  try {
    team = await fetchTeamForUi(entryId, forceRefresh);
  } catch (err) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">{pt("errorTitle")}</h1>
        <p className="mt-2 text-sm text-rose-100/90">
          {(err as Error).message}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-brand-accent hover:bg-white/10"
        >
          {pt("backHome")}
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

  const picksGwStr = String(team.picks_gw ?? "?");
  const longGwStr = String(team.long_team_gw ?? "?");
  const prevGwStr = String((team.picks_gw ?? 1) - 1);

  let baselineBanner: string | null = null;
  if (freeHitContext) {
    if (hasRevert) {
      baselineBanner = useFreeHitSquad
        ? fb("plannerShowTempFh", { picksGw: picksGwStr })
        : fb("plannerUsingRevert", { longGw: longGwStr });
    } else {
      baselineBanner = fb("plannerMissingRevert", {
        picksGw: picksGwStr,
        prevGw: prevGwStr,
      });
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
