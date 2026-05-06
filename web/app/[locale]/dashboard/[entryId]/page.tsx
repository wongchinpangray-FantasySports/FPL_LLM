import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { fetchTeamForUi, isFreeHitOnPicksGw } from "@/lib/tools/team";
import {
  allPremierTeamIds,
  fdrClass,
  FPL_LAST_SEASON_GW,
  teamsFixtureGrid,
} from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import {
  loadDoubleGameweekKeys,
  projectPlayers,
  resolveCurrentGw,
} from "@/lib/xp";
import { XpHeatmap, buildHeatmapRow } from "@/components/xp-heatmap";

export const dynamic = "force-dynamic";

function SlotLabel({ pos }: { pos: string | null }) {
  return (
    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
      {pos ?? "?"}
    </span>
  );
}

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
        <h1 className="text-xl font-semibold text-white">{dt("errorTitle")}</h1>
        <p className="mt-2 text-sm text-rose-100/90">{msg}</p>
        {show403 ? (
          <p className="mt-3 text-xs leading-relaxed text-rose-200/80">
            {dt("errorFpl403Hint")}
          </p>
        ) : null}
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-brand-accent hover:bg-white/10"
        >
          {dt("backHome")}
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

  /** FPL regular season is 38 gameweeks; never show GW39+ in the heatmap. */
  const rawStartGw = (team.current_gw ?? 0) + 1;
  const horizon = Math.max(
    0,
    Math.min(5, FPL_LAST_SEASON_GW - rawStartGw + 1),
  );
  const startGw = rawStartGw;
  const allTeamIds = await allPremierTeamIds();
  const grid = await teamsFixtureGrid(allTeamIds, startGw, horizon);
  const gwHeaders = Array.from({ length: horizon }, (_, i) => startGw + i);

  const dgwTeamGw = await loadDoubleGameweekKeys(
    allTeamIds,
    startGw,
    horizon > 0 ? startGw + horizon - 1 : startGw,
  );

  const startingXI = displayPicks.filter((p) => p.is_starter);
  const bench = displayPicks.filter((p) => !p.is_starter);

  // Project xP for every player in the squad over the horizon.
  const { current } = await resolveCurrentGw();
  const projections =
    horizon > 0
      ? await projectPlayers(displayPicks.map((p) => p.fpl_id), {
          currentGw: current,
          fromGw: startGw,
          toGw: startGw + horizon - 1,
        })
      : new Map();

  const orderedPicks = [...startingXI, ...bench];
  const heatmapRows = orderedPicks
    .map((pick) => {
      const proj = projections.get(pick.fpl_id);
      if (!proj) return null;
      return buildHeatmapRow(proj, {
        is_starter: pick.is_starter,
        is_captain: pick.is_captain,
        is_vice_captain: pick.is_vice_captain,
      });
    })
    .filter(<T,>(v: T | null): v is T => v !== null);

  const starterXPTotal = heatmapRows
    .filter((r) => r.is_starter)
    .reduce((s, r) => s + r.xp_total, 0);
  const benchXPTotal = heatmapRows
    .filter((r) => !r.is_starter)
    .reduce((s, r) => s + r.xp_total, 0);

  return (
    <div className="flex flex-col gap-7 md:gap-10 lg:gap-12">
      <section className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6 md:gap-8 md:pb-8">
        <div className="flex max-w-xl flex-col gap-1.5 sm:gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-accent">
            {dt("eyebrow")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
            {team.entry.name}
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            {team.entry.player_first_name} {team.entry.player_last_name} ·{" "}
            <span className="text-slate-300">
              {team.entry.summary_overall_points.toLocaleString()} {dt("pts")}
            </span>{" "}
            · {dt("overallRank")}{" "}
            <span className="text-slate-300">
              {team.entry.summary_overall_rank.toLocaleString()}
            </span>
          </p>
          <p className="text-[11px] leading-relaxed text-slate-500">
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
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:flex lg:flex-wrap lg:gap-3">
          <Stat label={dt("stats.bank")} value={`£${team.bank.toFixed(1)}m`} />
          <Stat
            label={dt("stats.teamValue")}
            value={`£${team.team_value.toFixed(1)}m`}
          />
          <Stat
            label={dt("stats.freeTransfers")}
            value={String(team.free_transfers)}
          />
          <Stat label={dt("stats.activeChip")} value={team.active_chip ?? "—"} />
          <Stat
            label={dt("stats.xpXi", { horizon })}
            value={starterXPTotal.toFixed(1)}
          />
          <Stat
            label={dt("stats.xpBench", { horizon })}
            value={benchXPTotal.toFixed(1)}
          />
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
                  className="font-medium text-amber-200 underline decoration-amber-500/50 underline-offset-2 hover:text-white"
                >
                  {dt("freeHitShowRevert")}
                </Link>
              ) : (
                <Link
                  href={dashboardToggleHref(true)}
                  className="font-medium text-amber-200 underline decoration-amber-500/50 underline-offset-2 hover:text-white"
                >
                  {dt("freeHitViewTemp")}
                </Link>
              )}
            </p>
          ) : null}
        </section>
      )}

      {team.picks_may_be_stale && (
        <section className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm">
          <strong className="font-semibold">{dt("staleTitle")}</strong>{" "}
          {dt("staleBody", { gw: team.current_gw ?? "?" })}{" "}
          <Link
            href={`/dashboard/${entryId}?refresh=1`}
            className="underline hover:text-amber-50"
          >
            {dt("refresh")}
          </Link>
        </section>
      )}

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
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
          <Legend
            flagsLabel={dt("xpLegendNote")}
            xpPerFixturePrefix={dt("xpPerFixturePrefix")}
            injuryLabel={dt("legendInjury")}
          />
        </div>
      </section>

      <section className="space-y-5 md:space-y-8">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            {dt("squad")}
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">
            {dt("startingXI")}
          </h2>
        </div>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-3">
          {startingXI.map((p) => {
            const dgwGws = upcomingDgwGwsForTeam(
              p.team_id,
              dgwTeamGw,
              gwHeaders,
            );
            return (
              <PlayerCard
                key={p.fpl_id}
                p={p}
                formLabel={dt("playerFormLabel")}
                dgwLine={
                  dgwGws.length
                    ? dt("playerDgwLine", { gws: dgwGws.join(" · ") })
                    : undefined
                }
              />
            );
          })}
        </div>
        <div className="mt-6 md:mt-10">
          <h2 className="mb-2 text-lg font-semibold tracking-tight text-white md:mb-3 md:text-xl">
            {dt("bench")}
          </h2>
        </div>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-4">
          {bench.map((p) => {
            const dgwGws = upcomingDgwGwsForTeam(
              p.team_id,
              dgwTeamGw,
              gwHeaders,
            );
            return (
              <PlayerCard
                key={p.fpl_id}
                p={p}
                compact
                formLabel={dt("playerFormLabel")}
                dgwLine={
                  dgwGws.length
                    ? dt("playerDgwLine", { gws: dgwGws.join(" · ") })
                    : undefined
                }
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              {dt("fixturesEyebrow")}
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              {dt("fixturesTitle", { horizon })}
            </h2>
          </div>
          <span className="text-xs text-slate-400">{dt("fixturesHint")}</span>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
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
                <tr key={t.team_id} className="border-t border-white/5">
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
                              "flex min-h-[2.75rem] flex-col gap-1 rounded-md border border-white/10 px-1.5 py-1 text-center text-xs",
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
                                <div className="text-[10px] text-slate-200/70">
                                  FDR {f.fdr ?? "–"}
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
                          <div className="rounded-md border border-white/5 bg-white/5 px-2 py-1 text-center text-xs text-slate-500">
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

      <section>
        <Link
          href="/chat"
          className="group flex flex-col gap-1 rounded-xl border border-brand-accent/25 bg-brand-accent/[0.06] p-4 transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/[0.09] sm:rounded-2xl sm:p-5 md:flex-row md:items-center md:justify-between md:p-6"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-brand-accent">
              {dt("assistantEyebrow")}
            </p>
            <p className="mt-1 font-medium text-white">{dt("assistantTitle")}</p>
            <p className="mt-1 text-sm text-slate-400">
              {dt("assistantDesc")}
            </p>
          </div>
          <span className="mt-3 shrink-0 text-brand-accent transition-transform group-hover:translate-x-0.5 md:mt-0 md:text-lg">
            →
          </span>
        </Link>
      </section>
    </div>
  );
}

function upcomingDgwGwsForTeam(
  teamId: number | null | undefined,
  dgwKeys: Set<string>,
  gwHeaders: number[],
): number[] {
  if (teamId == null) return [];
  return gwHeaders.filter((g) => dgwKeys.has(`${teamId}:${g}`));
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] transition-colors hover:border-white/[0.12] sm:rounded-xl sm:px-3 sm:py-2.5">
      <div className="text-[9px] font-medium uppercase leading-tight tracking-wider text-slate-500 sm:text-[10px]">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-white sm:text-base">
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
    { label: "0–1", cls: "bg-slate-700/70 text-slate-200" },
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

function PlayerCard({
  p,
  compact,
  formLabel,
  dgwLine,
}: {
  formLabel: string;
  dgwLine?: string;
  p: {
    fpl_id: number;
    web_name: string | null;
    name: string | null;
    team: string | null;
    position: string | null;
    price: number | null;
    form: number | null;
    is_captain: boolean;
    is_vice_captain: boolean;
  };
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] transition-colors hover:border-white/[0.12] sm:rounded-xl sm:p-3.5",
        p.is_captain && "ring-1 ring-brand-accent/80",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold sm:text-base">
            {p.web_name ?? p.name ?? `#${p.fpl_id}`}
            {p.is_captain && (
              <span className="ml-1 text-brand-accent text-xs">(C)</span>
            )}
            {p.is_vice_captain && (
              <span className="ml-1 text-slate-300 text-xs">(V)</span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            {p.team ?? "?"} <SlotLabel pos={p.position} />
          </div>
          {dgwLine ? (
            <p
              className="mt-1.5 text-[10px] font-medium leading-snug text-yellow-200/95"
              title={dgwLine}
            >
              <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 ring-1 ring-yellow-400/35">
                {dgwLine}
              </span>
            </p>
          ) : null}
        </div>
        <div className="text-right text-xs">
          <div className="text-slate-300">
            £{p.price !== null ? p.price.toFixed(1) : "?"}m
          </div>
          {!compact && (
            <div className="text-slate-400">
              {formLabel} {p.form ?? "–"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
