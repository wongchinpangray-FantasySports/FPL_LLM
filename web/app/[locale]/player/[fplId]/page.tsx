import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { HomeBackLink } from "@/components/home-back-link";
import { PageHeader } from "@/components/page-header";
import { xpCellClass } from "@/components/xp-heatmap";
import { loadPlayerProfileBundle } from "@/lib/player-hub";
import { loadPlayerGwHistory } from "@/lib/player-gw-history";
import { PlayerGwBarChart } from "@/components/player/player-gw-bar-chart";
import { PlayerRadarCompareSection } from "@/components/player/player-radar-compare-section";
import { getServerSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { FixtureProjection } from "@/lib/xp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function round(n: number, d = 2): number {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; fplId: string };
}) {
  const fplId = Number(params.fplId);
  if (!Number.isFinite(fplId) || fplId <= 0) {
    return { title: "Player · FALEAGUE AI" };
  }
  const supa = getServerSupabase();
  const { data } = await supa
    .from("players_static")
    .select("web_name,name")
    .eq("fpl_id", fplId)
    .maybeSingle();
  const label =
    (data?.web_name as string | undefined) ??
    (data?.name as string | undefined) ??
    `#${fplId}`;
  return { title: `${label} · FALEAGUE AI` };
}

export default async function PlayerHubPage({
  params,
  searchParams,
}: {
  params: { locale: string; fplId: string };
  searchParams?: { horizon?: string };
}) {
  const { locale, fplId: fplIdStr } = params;
  setRequestLocale(locale);

  const fplId = Number(fplIdStr);
  if (!Number.isFinite(fplId) || fplId <= 0) notFound();

  const horizon = Math.min(
    8,
    Math.max(1, Number(searchParams?.horizon) || 5),
  );

  const [data, gwHistory] = await Promise.all([
    loadPlayerProfileBundle(fplId, horizon),
    loadPlayerGwHistory(fplId, 10),
  ]);
  if (!data) notFound();

  const t = await getTranslations({ locale, namespace: "playerPage" });
  const common = await getTranslations({ locale, namespace: "common" });
  const { static: row, projection: p, currentGw, fromGw, toGw, radar } = data;

  const displayName = row.web_name ?? row.name ?? `#${fplId}`;
  const fixtures = [...p.fixtures].sort((a, b) => a.gw - b.gw);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-8">
      <div className="flex flex-wrap gap-4 text-sm">
        <HomeBackLink label={common("backHome")} />
        <Link
          href="/players"
          className="text-muted-foreground transition-colors hover:text-brand-accent"
        >
          {t("backPlayers")}
        </Link>
      </div>

      <PageHeader
        eyebrow={t("eyebrow")}
        title={displayName}
        description={t("description", {
          team: row.team ?? "—",
          pos: row.position ?? "—",
          gw0: String(currentGw),
          gw1: String(fromGw),
          gw2: String(toGw),
        })}
      />

      <section className="rounded-xl border border-border bg-card/50 p-4 sm:p-5">
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          {t("dataSourcesTitle")}
        </h2>
        <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-muted-foreground">
          <li>{t("dataSourceFpl")}</li>
          <li>{t("dataSourceModel")}</li>
        </ul>
      </section>

      <PlayerRadarCompareSection
        baseFplId={fplId}
        basePosition={row.position}
        baseRadar={radar}
      />

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap gap-4 border-b border-border pb-4">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">{t("price")}</p>
            <p className="text-lg font-semibold text-foreground">
              £{row.base_price != null ? row.base_price.toFixed(1) : "?"}m
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">{t("form")}</p>
            <p className="text-lg font-semibold text-foreground">{row.form ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">
              {t("ownership")}
            </p>
            <p className="text-lg font-semibold text-foreground">
              {row.selected_by_percent != null
                ? `${Number(row.selected_by_percent).toFixed(1)}%`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">{t("status")}</p>
            <p className="text-sm font-medium text-foreground/90">
              {row.status ?? "—"}
              {row.chance_of_playing != null &&
              row.chance_of_playing < 100 ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {row.chance_of_playing}%
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {p.availability < 1 && p.availability_note ? (
          <p className="mt-3 text-sm text-rose-200/90">
            {p.availability_note} ({Math.round(p.availability * 100)}%)
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-input px-3 py-2">
            <p className="text-[10px] uppercase text-muted-foreground">{t("xpHorizon")}</p>
            <p className="mt-1 text-xl font-semibold text-brand-accent">
              {p.xp_total.toFixed(1)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({p.xp_per_game.toFixed(2)} / GW)
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-input px-3 py-2">
            <p className="text-[10px] uppercase text-muted-foreground">{t("setPieces")}</p>
            <p className="mt-1 text-xs text-foreground/70">
              PEN {p.set_pieces.penalties ?? "—"} · FK{" "}
              {p.set_pieces.freekicks ?? "—"} · COR{" "}
              {p.set_pieces.corners ?? "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-input px-3 py-2">
            <p className="text-[10px] uppercase text-muted-foreground">{t("valueXm")}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {p.value_per_million != null
                ? p.value_per_million.toFixed(2)
                : "—"}
            </p>
          </div>
        </div>
      </section>

      {row.news ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          <p className="text-[10px] font-medium uppercase text-amber-200/80">
            {t("news")}
          </p>
          <p className="mt-1 leading-relaxed">{row.news}</p>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          {t("seasonSection")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("totalPts")}</dt>
            <dd className="font-medium text-foreground">{row.total_points ?? "—"}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("minutes")}</dt>
            <dd className="font-medium text-foreground">{row.minutes ?? "—"}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("goalsAssists")}</dt>
            <dd className="font-medium text-foreground">
              {row.goals_scored ?? 0} / {row.assists ?? 0}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("cleanSheets")}</dt>
            <dd className="font-medium text-foreground">{row.clean_sheets ?? "—"}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("ict")}</dt>
            <dd className="font-medium text-foreground">{row.ict_index ?? "—"}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("transfersGw")}</dt>
            <dd className="font-medium text-foreground">
              {row.transfers_in_event != null &&
              row.transfers_out_event != null
                ? `${row.transfers_in_event} in · ${row.transfers_out_event} out`
                : "—"}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("ictInf")}</dt>
            <dd className="font-medium text-foreground">{row.influence ?? "—"}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("ictCre")}</dt>
            <dd className="font-medium text-foreground">{row.creativity ?? "—"}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("ictThr")}</dt>
            <dd className="font-medium text-foreground">{row.threat ?? "—"}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("seasonXg")}</dt>
            <dd className="font-medium text-foreground">
              {row.expected_goals != null ? row.expected_goals.toFixed(2) : "—"}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("seasonXa")}</dt>
            <dd className="font-medium text-foreground">
              {row.expected_assists != null
                ? row.expected_assists.toFixed(2)
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          {t("rollingSection", { gws: p.rolling.window_gws })}
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("rollPts")}</dt>
            <dd className="font-medium text-foreground">{p.rolling.points}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("rollMins")}</dt>
            <dd className="font-medium text-foreground">{p.rolling.minutes}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("rollXgXa")}</dt>
            <dd className="font-medium text-foreground">
              {p.rolling.xg.toFixed(2)} / {p.rolling.xa.toFixed(2)}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("rollStarts")}</dt>
            <dd className="font-medium text-foreground">{p.rolling.starts}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <dt className="text-muted-foreground">{t("rollDc")}</dt>
            <dd className="font-medium text-foreground">{p.rolling.dc_points}</dd>
          </div>
        </dl>
      </section>

      <PlayerGwBarChart rows={gwHistory} className="p-4 sm:p-5" />

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            {t("fixturesSection")}
          </h2>
          <span className="text-xs text-muted-foreground">
            GW{fromGw}–{toGw}
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase text-muted-foreground">
                <th className="px-2 py-2 sm:px-3">{t("tblGw")}</th>
                <th className="px-2 py-2">{t("tblOpp")}</th>
                <th className="px-2 py-2">{t("tblFdr")}</th>
                <th className="px-2 py-2 text-right">{t("tblMins")}</th>
                <th className="px-2 py-2 text-right">{t("tblXp")}</th>
              </tr>
            </thead>
            <tbody>
              {fixtures.map((fx: FixtureProjection) => (
                <tr key={`${fx.gw}-${fx.fixture_id}`} className="border-t border-border/60">
                  <td className="px-2 py-2 text-foreground/70 sm:px-3">{fx.gw}</td>
                  <td className="px-2 py-2 font-medium text-foreground">
                    {fx.opp_short}
                    <span className="font-normal text-muted-foreground">
                      {fx.home ? " (H)" : " (A)"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{fx.fdr ?? "—"}</td>
                  <td className="px-2 py-2 text-right text-foreground/70">
                    {fx.expected_minutes.toFixed(0)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span
                      className={cn(
                        "inline-block rounded px-2 py-0.5 font-semibold tabular-nums",
                        xpCellClass(fx.xp_total),
                      )}
                    >
                      {round(fx.xp_total, 2).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {t("fixtureHint")}
        </p>
      </section>

      <section className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Link
          href="/chat"
          className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground/90 transition-colors hover:border-brand-accent/30 hover:text-foreground"
        >
          {t("openChat")}
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground/90 transition-colors hover:border-brand-accent/30 hover:text-foreground"
        >
          {t("openDashboard")}
        </Link>
        <Link
          href="/players"
          className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground/90 transition-colors hover:border-brand-accent/30 hover:text-foreground"
        >
          {t("openPlayerSearch")}
        </Link>
      </section>
    </div>
  );
}
