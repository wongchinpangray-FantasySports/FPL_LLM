import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import {
  computeChipsRemaining,
  fetchTeamForUi,
  isFreeHitOnPicksGw,
} from "@/lib/tools/team";
import {
  allPremierTeamIds,
  cachedAllClubsFixtureGrid,
  fdrClass,
  FPL_LAST_SEASON_GW,
} from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import {
  loadDoubleGameweekKeys,
  projectPlayers,
} from "@/lib/xp";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { formatFplInteger } from "@/lib/fpl";
import { ensureFplEntryPage } from "@/lib/auth/ensure-fpl-entry-page";
import { normalizeFplFdr } from "@/lib/fpl/fdr";
import { HomeBackLink } from "@/components/home-back-link";
import { XpHeatmap, buildHeatmapRow, buildHeatmapRowFromPick } from "@/components/xp-heatmap";
import { DashboardSquadPanel } from "@/components/dashboard/dashboard-squad-panel";
import { loadPriceForecastMap } from "@/lib/fpl/insights/price-forecast";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: { locale: string; entryId: string };
  searchParams?: { refresh?: string; squad?: string };
}) {
  const entryId = Number(params.entryId);
  if (!Number.isFinite(entryId) || entryId <= 0) notFound();

  setRequestLocale(params.locale);

  await ensureFplEntryPage(entryId, params.locale);

  const dt = await getTranslations({
    locale: params.locale,
    namespace: "dashboard",
  });

  const forceRefresh =
    searchParams?.refresh === "1" || searchParams?.refresh === "true";
  const useFreeHitSquad = searchParams?.squad === "freehit";

  let team;
  try {
    team = await fetchTeamForUi(entryId, forceRefresh);
  } catch (err) {
    const msg = (err as Error).message;
    const show403 = /\b403\b/.test(msg);
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">{dt("errorTitle")}</h1>
        <p className="mt-2 text-sm text-rose-100/90">{msg}</p>
        {show403 ? (
          <p className="mt-3 text-xs leading-relaxed text-rose-200/80">
            {dt("errorFpl403Hint")}
          </p>
        ) : null}
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg border border-border bg-muted px-4 py-2 text-sm text-brand-accent hover:bg-muted"
        >
          {dt("backHome")}
        </Link>
      </div>
    );
  }

  try {
  const hasRevert = Boolean(team.long_team_picks?.length);
  const freeHitContext = isFreeHitOnPicksGw(
    team.active_chip,
    team.picks_gw,
    team.chips_used ?? [],
  );
  const displayPicks =
    useFreeHitSquad || !hasRevert ? team.picks : team.long_team_picks!;

  function dashboardToggleHref(showFreeHit: boolean) {
    const q = new URLSearchParams();
    if (forceRefresh) q.set("refresh", "1");
    if (showFreeHit) q.set("squad", "freehit");
    const s = q.toString();
    return s ? `/dashboard/${entryId}?${s}` : `/dashboard/${entryId}`;
  }

  const fb = await getTranslations({
    locale: params.locale,
    namespace: "fhBanner",
  });
  const picksGwStr = String(team.picks_gw ?? "?");
  const longGwStr = String(team.long_team_gw ?? "?");
  const prevGwStr = String((team.picks_gw ?? 1) - 1);

  let baselineBanner: string | null = null;
  if (freeHitContext) {
    if (hasRevert) {
      baselineBanner = useFreeHitSquad
        ? fb("dashboardShowTempFh", { picksGw: picksGwStr })
        : fb("dashboardUsingRevert", { longGw: longGwStr });
    } else {
      baselineBanner = fb("dashboardMissingRevert", {
        picksGw: picksGwStr,
        prevGw: prevGwStr,
      });
    }
  }

  /** First GW column: FPL `picks_gw` when present (same event as Pick Team), else `current_event+1`. */
  const planningGwFallback = Math.min(
    FPL_LAST_SEASON_GW,
    Math.max(1, (team.current_gw ?? 0) + 1),
  );
  const startGw =
    team.picks_gw != null &&
    team.picks_gw >= 1 &&
    team.picks_gw <= FPL_LAST_SEASON_GW
      ? team.picks_gw
      : planningGwFallback;
  const horizon = Math.max(
    0,
    Math.min(5, FPL_LAST_SEASON_GW - startGw + 1),
  );
  const allTeamIds = await allPremierTeamIds();
  const fplSeason = await getCurrentFplSeason();
  const gwHeaders = Array.from({ length: horizon }, (_, i) => startGw + i);

  let grid: Awaited<ReturnType<typeof cachedAllClubsFixtureGrid>> = [];
  try {
    grid = await cachedAllClubsFixtureGrid(startGw, horizon, fplSeason);
  } catch {
    grid = [];
  }

  let dgwTeamGw = new Set<string>();
  try {
    dgwTeamGw = await loadDoubleGameweekKeys(
      allTeamIds,
      startGw,
      horizon > 0 ? startGw + horizon - 1 : startGw,
      fplSeason,
    );
  } catch {
    dgwTeamGw = new Set();
  }

  const startingXI = displayPicks.filter((p) => p.is_starter);
  const bench = displayPicks.filter((p) => !p.is_starter);
  const squadEmpty = displayPicks.length === 0;

  // Rolling stats through GW `startGw - 1` so xP matches home Best XI / planner
  // (avoid mixing DB `is_current` with FPL entry `current_event` lag).
  const currentGwForProjection = Math.max(1, startGw - 1);

  const projections =
    horizon > 0
      ? await projectPlayers(displayPicks.map((p) => p.fpl_id), {
          currentGw: currentGwForProjection,
          fromGw: startGw,
          toGw: startGw + horizon - 1,
        })
      : new Map();

  const orderedPicks = [...startingXI, ...bench];
  const heatmapRows = orderedPicks.map((pick) => {
    const proj = projections.get(pick.fpl_id);
    if (!proj) {
      return buildHeatmapRowFromPick({
        fpl_id: pick.fpl_id,
        team_id: pick.team_id ?? null,
        web_name: pick.web_name,
        team: pick.team,
        position: pick.position,
        is_starter: pick.is_starter,
        is_captain: pick.is_captain,
        is_vice_captain: pick.is_vice_captain,
        price: pick.price ?? null,
      });
    }
    return buildHeatmapRow(proj, {
      is_starter: pick.is_starter,
      is_captain: pick.is_captain,
      is_vice_captain: pick.is_vice_captain,
    });
  });

  const starterXPTotal = heatmapRows
    .filter((r) => r.is_starter)
    .reduce((s, r) => s + r.xp_total, 0);
  const benchXPTotal = heatmapRows
    .filter((r) => !r.is_starter)
    .reduce((s, r) => s + r.xp_total, 0);

  const chipRm = computeChipsRemaining(team.chips_used ?? []);
  const chipSegments: string[] = [];
  if (chipRm.wildcardsRemaining > 0) {
    chipSegments.push(
      dt("stats.chipRemainingWildcards", { n: chipRm.wildcardsRemaining }),
    );
  }
  if (chipRm.freeHitsRemaining > 0) {
    chipSegments.push(dt("stats.chipRemainingFh", { n: chipRm.freeHitsRemaining }));
  }
  if (chipRm.benchBoostsRemaining > 0) {
    chipSegments.push(
      dt("stats.chipRemainingBb", { n: chipRm.benchBoostsRemaining }),
    );
  }
  if (chipRm.tripleCaptainsRemaining > 0) {
    chipSegments.push(
      dt("stats.chipRemainingTc", { n: chipRm.tripleCaptainsRemaining }),
    );
  }
  const chipsDisplay =
    chipSegments.length > 0
      ? chipSegments.join(" · ")
      : dt("stats.chipsRemainingNone");

  const activeChipLabel = formatActiveChip(team.active_chip, dt);

  const nextGwXpByFplId = Object.fromEntries(
    heatmapRows.map((r) => {
      const gw0 = gwHeaders[0];
      const fxs = gw0 != null ? r.byGw?.[gw0] : undefined;
      const xp =
        fxs?.reduce((s, f) => s + (Number(f.xp_total) || 0), 0) ??
        r.xp_total / Math.max(horizon, 1);
      return [r.fpl_id, xp] as const;
    }),
  );

  const gwForecastByFplId = Object.fromEntries(
    heatmapRows.map((r) => {
      const cells: { gw: number; opp: string; xp: number }[] = [];
      for (const g of gwHeaders.slice(0, 5)) {
        const fxs = r.byGw?.[g] ?? [];
        if (fxs.length === 0) continue;
        const xp = fxs.reduce((s, f) => s + (Number(f.xp_total) || 0), 0);
        const opp = fxs
          .map((f) => `${f.opp_short}${f.home ? "" : " (A)"}`)
          .join("/");
        cells.push({ gw: g, opp, xp });
      }
      return [r.fpl_id, cells] as const;
    }),
  );

  const priceForecastMap = squadEmpty
    ? new Map<number, never>()
    : await loadPriceForecastMap(displayPicks.map((p) => p.fpl_id));
  const priceForecastByFplId = Object.fromEntries(
    [...priceForecastMap.entries()].map(([fplId, snap]) => [
      fplId,
      {
        status: snap.status,
        cost_change_event: snap.cost_change_event,
        progress: snap.progress,
      },
    ]),
  );

  return (
    <div className="flex flex-col gap-7 md:gap-10 lg:gap-12">
      <HomeBackLink label={dt("backHome")} />

      <section className="overflow-hidden rounded-2xl border border-border bg-card/70 shadow-[inset_0_1px_0_hsl(var(--border)/0.45)]">
        <div className="flex flex-col gap-5 p-4 sm:p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-accent">
                {dt("eyebrow")}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {team.entry.name}
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {team.entry.player_first_name} {team.entry.player_last_name} ·{" "}
                <span className="tabular-nums text-foreground/80">
                  {formatFplInteger(
                    team.entry.summary_overall_points,
                    params.locale,
                    "0",
                  )}{" "}
                  {dt("pts")}
                </span>{" "}
                · {dt("overallRank")}{" "}
                <span className="tabular-nums text-foreground/80">
                  {formatFplInteger(
                    team.entry.summary_overall_rank,
                    params.locale,
                  )}
                </span>
              </p>
            </div>
            <p className="max-w-xs text-right text-[11px] leading-relaxed text-muted-foreground">
              {freeHitContext && hasRevert && !useFreeHitSquad
                ? dt("squadSubRevert", {
                    longGw: team.long_team_gw ?? "?",
                    picksGw: team.picks_gw ?? "?",
                  })
                : freeHitContext && useFreeHitSquad
                  ? dt("squadSubFh", { picksGw: picksGwStr })
                  : dt("squadSubPicks", {
                      picksGw: team.picks_gw ?? team.current_gw ?? "?",
                    })}
              {relTime(team.fetched_at, dt)} ·{" "}
              <Link
                href={
                  useFreeHitSquad
                    ? `/dashboard/${entryId}?refresh=1&squad=freehit`
                    : `/dashboard/${entryId}?refresh=1`
                }
                className="font-medium text-brand-accent hover:underline"
              >
                {dt("refresh")}
              </Link>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OverviewMetric
              label={dt("stats.bank")}
              value={`£${team.bank.toFixed(1)}m`}
            />
            <OverviewMetric
              label={dt("stats.teamValue")}
              value={`£${team.team_value.toFixed(1)}m`}
            />
            <OverviewMetric
              label={dt("stats.freeTransfers")}
              value={String(team.free_transfers)}
            />
            <OverviewMetric
              label={dt("stats.activeChip")}
              value={activeChipLabel}
            />
          </div>

          <div className="grid gap-3 border-t border-border/70 pt-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-border/60 bg-background/40 px-3.5 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {dt("stats.chipsRemaining")}
              </p>
              <p className="mt-1 text-sm leading-snug text-foreground">
                {chipsDisplay}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <OverviewMetric
                label={dt("stats.xpXi", { horizon })}
                value={starterXPTotal.toFixed(1)}
                accent
              />
              <OverviewMetric
                label={dt("stats.xpBench", { horizon })}
                value={benchXPTotal.toFixed(1)}
              />
            </div>
          </div>
        </div>
      </section>

      {baselineBanner && (
        <section
          className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm leading-relaxed text-amber-100/90 sm:rounded-xl sm:px-4 sm:py-3"
          role="status"
        >
          <p>{baselineBanner}</p>
          {freeHitContext && hasRevert ? (
            <p className="mt-2 flex flex-wrap gap-4 text-xs text-amber-200/85">
              {useFreeHitSquad ? (
                <Link
                  href={dashboardToggleHref(false)}
                  className="font-medium text-amber-200 underline decoration-amber-500/50 underline-offset-2 hover:text-foreground"
                >
                  {dt("freeHitShowRevert")}
                </Link>
              ) : (
                <Link
                  href={dashboardToggleHref(true)}
                  className="font-medium text-amber-200 underline decoration-amber-500/50 underline-offset-2 hover:text-foreground"
                >
                  {dt("freeHitViewTemp")}
                </Link>
              )}
            </p>
          ) : null}
        </section>
      )}

      {squadEmpty && (
        <section
          className="rounded-xl border border-brand-accent/25 bg-brand-accent/[0.06] px-4 py-4 sm:px-5 sm:py-5"
          role="status"
        >
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            {dt("emptySquadTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {dt("emptySquadBodyPreseason", { picksGw: picksGwStr })}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/dashboard/${entryId}?refresh=1`}
              className="inline-flex rounded-lg border border-brand-accent/40 bg-brand-accent/15 px-3 py-2 text-sm font-medium text-brand-accent hover:bg-brand-accent/25"
            >
              {dt("emptySquadSync")}
            </Link>
            <a
              href="https://fantasy.premierleague.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {dt("emptySquadSaveOnFpl")}
            </a>
            <Link
              href={`/planner/${entryId}`}
              className="inline-flex rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {dt("emptySquadOpenPlanner")}
            </Link>
          </div>
        </section>
      )}

      <section className="space-y-5 md:space-y-8">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {dt("squad")}
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
            {dt("startingXI")}
          </h2>
        </div>
        {!squadEmpty ? (
          <DashboardSquadPanel
            picks={orderedPicks.map((p) => {
              const row = heatmapRows.find((r) => r.fpl_id === p.fpl_id);
              return {
                fpl_id: p.fpl_id,
                slot: p.slot,
                web_name: p.web_name,
                name: p.name,
                team: p.team,
                team_id: p.team_id ?? null,
                position: p.position,
                price: p.price,
                form: p.form,
                is_starter: p.is_starter,
                is_captain: p.is_captain,
                is_vice_captain: p.is_vice_captain,
                availability_note: row?.availability_note ?? null,
              };
            })}
            title={dt("startingXI")}
            caption={dt("squadPitchCaption")}
            benchLabel={dt("bench")}
            horizon={Math.max(1, horizon)}
            nextGwXpByFplId={nextGwXpByFplId}
            gwForecastByFplId={gwForecastByFplId}
            priceForecastByFplId={priceForecastByFplId}
            inspectNameTitle={dt("squadPitchCaption")}
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-3 md:gap-4">
        <XpHeatmap
          rows={heatmapRows}
          gws={gwHeaders}
          dgwTeamGw={dgwTeamGw}
          title={
            gwHeaders.length > 0
              ? dt("xpHeatmap", {
                  from: gwHeaders[0],
                  to: gwHeaders[gwHeaders.length - 1],
                })
              : undefined
          }
          legendHint={dt("heatmapLegendHint")}
          columnHeaders={{
            player: dt("heatmapPlayer"),
            team: dt("heatmapTeam"),
            pos: dt("heatmapPos"),
            total: dt("heatmapTotal"),
          }}
          gwTotalLabel={dt("heatmapGwTotal")}
          benchLabel={dt("heatmapBench")}
        />
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <Legend
            flagsLabel={dt("xpLegendNote")}
            xpPerFixturePrefix={dt("xpPerFixturePrefix")}
            injuryLabel={dt("legendInjury")}
          />
        </div>
      </section>

      {grid.length > 0 ? (
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {dt("fixturesEyebrow")}
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {dt("fixturesTitle", { horizon })}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">{dt("fixturesHint")}</span>
        </div>
        <div className="scroll-table scroll-table--bordered rounded-2xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">{dt("fixtureTableTeam")}</th>
                {gwHeaders.map((g) => (
                  <th key={g} className="px-2 py-2 text-center">
                    GW{g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((t) => (
                <tr key={t.team_id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-medium">{t.short}</td>
                  {gwHeaders.map((g) => {
                    const fs = t.fixtures.filter((x) => x.gw === g);
                    const calendarDgw = dgwTeamGw.has(`${t.team_id}:${g}`);
                    const isDgw = fs.length >= 2 || (calendarDgw && fs.length > 0);
                    return (
                      <td key={g} className="px-1.5 py-1.5 align-top">
                        {fs.length > 0 ? (
                          <div
                            className={cn(
                              "flex min-h-[2.75rem] flex-col gap-1 rounded-md border border-border px-1.5 py-1 text-center text-xs",
                              isDgw &&
                                "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-950 shadow-[0_0_0_1px_rgba(250,204,21,0.35)]",
                            )}
                          >
                            {fs.map((f, idx) => (
                              <div
                                key={`${f.opp}-${f.home}-${idx}`}
                                className={cn(
                                  "rounded-md border px-1.5 py-0.5",
                                  fdrClass(f.fdr),
                                )}
                              >
                                <div className="font-semibold">
                                  {f.opp}
                                  {!f.home ? " (A)" : ""}
                                </div>
                                <div className="text-[10px] text-foreground/90">
                                  FDR {normalizeFplFdr(f.fdr) ?? "–"}
                                </div>
                              </div>
                            ))}
                            {isDgw && fs.length >= 2 ? (
                              <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-yellow-200/95">
                                DGW
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-md border border-border/60 bg-muted px-2 py-1 text-center text-xs text-muted-foreground">
                            —
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-brand-accent">
            {dt("toolsEyebrow")}
          </p>
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {dt("toolsTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {dt("toolsDescription")}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              {
                href: `/planner/${entryId}`,
                label: dt("toolsPlanner"),
                body: dt("toolsPlannerBody"),
                accent: true,
              },
              {
                href: `/manager/${entryId}`,
                label: dt("toolsManager"),
                body: dt("toolsManagerBody"),
                accent: false,
              },
              {
                href: "/squad-builder",
                label: dt("toolsSquadBuilder"),
                body: dt("toolsSquadBuilderBody"),
                accent: false,
              },
              {
                href: "/fpl/insights",
                label: dt("toolsInsights"),
                body: dt("toolsInsightsBody"),
                accent: false,
              },
              {
                href: "/fpl/fixtures",
                label: dt("toolsFixtures"),
                body: dt("toolsFixturesBody"),
                accent: false,
              },
              {
                href: "/players",
                label: dt("toolsPlayers"),
                body: dt("toolsPlayersBody"),
                accent: false,
              },
            ] satisfies {
              href: string;
              label: string;
              body: string;
              accent: boolean;
            }[]
          ).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-start justify-between gap-3 rounded-xl border px-3.5 py-3 no-underline transition-colors",
                item.accent
                  ? "border-brand-accent/35 bg-brand-accent/[0.07] hover:border-brand-accent/55 hover:bg-brand-accent/15"
                  : "border-border bg-card/50 hover:border-brand-accent/40 hover:bg-muted/30",
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground group-hover:text-brand-accent">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {item.body}
                </span>
              </span>
              <span className="shrink-0 pt-0.5 text-muted-foreground group-hover:text-brand-accent">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load dashboard";
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">{dt("errorTitle")}</h1>
        <p className="mt-2 text-sm text-rose-100/90">{msg}</p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg border border-border bg-muted px-4 py-2 text-sm text-brand-accent hover:bg-muted"
        >
          {dt("backHome")}
        </Link>
      </div>
    );
  }
}

function formatActiveChip(
  chip: string | null | undefined,
  dt: Awaited<ReturnType<typeof getTranslations>>,
): string {
  if (!chip) return "—";
  const key = chip.toLowerCase();
  if (key === "bboost") return dt("chipBb");
  if (key === "freehit") return dt("chipFh");
  if (key === "wildcard") return dt("chipWc");
  if (key === "3xc") return dt("chipTc");
  return chip.toUpperCase();
}

function relTime(
  iso: string,
  dt: Awaited<ReturnType<typeof getTranslations>>,
): string {
  const parsed = new Date(iso).getTime();
  if (!Number.isFinite(parsed)) return dt("relJustNow");
  const diff = Date.now() - parsed;
  if (diff < 60_000) return dt("relJustNow");
  if (diff < 3_600_000)
    return dt("relMinutesAgo", { n: Math.floor(diff / 60_000) });
  if (diff < 86_400_000)
    return dt("relHoursAgo", { n: Math.floor(diff / 3_600_000) });
  return dt("relDaysAgo", { n: Math.floor(diff / 86_400_000) });
}

function OverviewMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums sm:text-lg",
          accent ? "text-brand-accent" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Legend({
  flagsLabel,
  xpPerFixturePrefix = "xP/fixture:",
  injuryLabel = "injury %",
}: {
  flagsLabel: string;
  xpPerFixturePrefix?: string;
  injuryLabel?: string;
}) {
  const buckets: Array<{ label: string; cls: string }> = [
    { label: "0–1", cls: "bg-slate-700/70 text-foreground/90" },
    { label: "1–2", cls: "bg-sky-900/70 text-sky-100" },
    { label: "2–3", cls: "bg-teal-800/80 text-teal-50" },
    { label: "3–4.5", cls: "bg-emerald-700/85 text-emerald-50" },
    { label: "4.5–6", cls: "bg-emerald-500/90 text-emerald-950" },
    { label: "6+", cls: "bg-lime-300 text-emerald-950" },
  ];
  return (
    <>
      <span className="uppercase tracking-wider">{xpPerFixturePrefix}</span>
      {buckets.map((b) => (
        <span
          key={b.label}
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-semibold",
            b.cls,
          )}
        >
          {b.label}
        </span>
      ))}
      <span className="ml-2 uppercase tracking-wider">{flagsLabel}</span>
      <span className="rounded bg-amber-400/25 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
        PEN
      </span>
      <span className="rounded bg-purple-400/20 px-2 py-0.5 text-[10px] font-semibold text-purple-200">
        FK
      </span>
      <span className="rounded px-2 py-0.5 text-[10px] text-yellow-200 ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-950">
        DGW
      </span>
      <span className="rounded bg-rose-500/25 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
        {injuryLabel}
      </span>
    </>
  );
}
