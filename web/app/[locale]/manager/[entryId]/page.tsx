import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { loadManagerPerformance } from "@/lib/manager-performance";
import {
  ManagerOrTrendChart,
  ManagerPercentileChart,
  ManagerPointsCompareChart,
} from "@/components/manager/manager-charts";
import { fplGet } from "@/lib/fpl";
import type { FplEntry } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string; entryId: string };
}) {
  const entryId = Number(params.entryId);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return { title: "Manager · FALEAGUE AI" };
  }
  try {
    const entry = await fplGet<FplEntry>(`/entry/${entryId}/`);
    const label = entry.name?.trim() || `#${entryId}`;
    return { title: `${label} · Manager · FALEAGUE AI` };
  } catch {
    return { title: "Manager · FALEAGUE AI" };
  }
}

export default async function ManagerEntryPage({
  params,
}: {
  params: { locale: string; entryId: string };
}) {
  const { locale, entryId: raw } = params;
  setRequestLocale(locale);

  const entryId = Number(raw);
  if (!Number.isFinite(entryId) || entryId <= 0) notFound();

  const t = await getTranslations({ locale, namespace: "managerPage" });

  let data;
  try {
    data = await loadManagerPerformance(entryId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const show403 = /\b403\b/.test(msg);
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">{t("errorTitle")}</h1>
        <p className="mt-2 text-sm text-rose-100/90">{msg}</p>
        {show403 ? (
          <p className="mt-3 text-xs leading-relaxed text-rose-200/80">
            {t("error403")}
          </p>
        ) : null}
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-brand-accent hover:bg-white/10"
        >
          {t("backHome")}
        </Link>
      </div>
    );
  }

  const latest = data.currentSeason[data.currentSeason.length - 1];
  const managerLabel =
    `${data.entry.player_first_name} ${data.entry.player_last_name}`.trim() ||
    "—";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-10">
      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href="/"
          className="text-slate-400 transition-colors hover:text-brand-accent"
        >
          {t("backHome")}
        </Link>
        <Link
          href={`/dashboard/${entryId}`}
          className="text-slate-400 transition-colors hover:text-brand-accent"
        >
          {t("linkDashboard")}
        </Link>
      </div>

      <PageHeader
        eyebrow={t("eyebrow")}
        title={data.entry.name}
        description={t("subtitle", {
          manager: managerLabel,
          gw: String(data.entry.current_event ?? "—"),
        })}
      />

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">
          {t("snapshotSection")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <dt className="text-[10px] uppercase text-slate-500">{t("snapshotOr")}</dt>
            <dd className="mt-1 font-semibold tabular-nums text-white">
              {data.entry.summary_overall_rank.toLocaleString()}
            </dd>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <dt className="text-[10px] uppercase text-slate-500">{t("snapshotPts")}</dt>
            <dd className="mt-1 font-semibold tabular-nums text-white">
              {data.entry.summary_overall_points.toLocaleString()}
            </dd>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <dt className="text-[10px] uppercase text-slate-500">{t("snapshotGw")}</dt>
            <dd className="mt-1 font-semibold tabular-nums text-white">
              {data.entry.current_event ?? "—"}
            </dd>
          </div>
          {latest ? (
            <>
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <dt className="text-[10px] uppercase text-slate-500">
                  {t("snapshotLastGw", { gw: latest.event })}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums text-brand-accent">
                  {latest.points} {t("snapshotPtsShort")}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <dt className="text-[10px] uppercase text-slate-500">
                  {t("snapshotLastOr")}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums text-white">
                  {latest.overall_rank.toLocaleString()}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <dt className="text-[10px] uppercase text-slate-500">
                  {t("snapshotPct")}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums text-sky-300">
                  {latest.percentile_rank}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">{t("chartOrSection")}</h2>
        <ManagerOrTrendChart rows={data.currentSeason} />
      </section>

      {data.currentSeason.length > 0 ? (
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">
            {t("chartPctSection")}
          </h2>
          <ManagerPercentileChart rows={data.currentSeason} />
        </section>
      ) : null}

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">{t("chartPtsSection")}</h2>
        <p className="mb-4 text-xs leading-relaxed text-slate-500">{t("benchmarkNote")}</p>
        <ManagerPointsCompareChart rows={data.compareByGw} />
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          {t("benchmarkSamples", {
            r10:
              data.benchmarksMeta.top10kSampleRank != null
                ? String(data.benchmarksMeta.top10kSampleRank)
                : "—",
            id10:
              data.benchmarksMeta.top10kSampleEntryId != null
                ? String(data.benchmarksMeta.top10kSampleEntryId)
                : "—",
            r100:
              data.benchmarksMeta.top100kSampleRank != null
                ? String(data.benchmarksMeta.top100kSampleRank)
                : "—",
            id100:
              data.benchmarksMeta.top100kSampleEntryId != null
                ? String(data.benchmarksMeta.top100kSampleEntryId)
                : "—",
          })}
        </p>
      </section>

      {data.pastSeasons.length > 0 ? (
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">
            {t("pastSeasonsSection")}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] uppercase text-slate-500">
                  <th className="px-3 py-2">{t("pastColSeason")}</th>
                  <th className="px-3 py-2">{t("pastColPts")}</th>
                  <th className="px-3 py-2">{t("pastColRank")}</th>
                </tr>
              </thead>
              <tbody>
                {data.pastSeasons.map((row, i) => (
                  <tr key={`${row.season_name}-${i}`} className="border-t border-white/5">
                    <td className="px-3 py-2 text-slate-300">{row.season_name}</td>
                    <td className="px-3 py-2 tabular-nums text-white">
                      {row.total_points.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-300">
                      {row.rank.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <p className="text-[11px] leading-relaxed text-slate-600">{t("footerNote")}</p>
    </div>
  );
}
