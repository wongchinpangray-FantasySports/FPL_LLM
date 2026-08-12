"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type {
  XpAccuracyGwSummary,
  XpAccuracyMiss,
  XpAccuracyPositionStats,
} from "@/lib/fpl/insights/xp-accuracy";
import {
  InsightsSortableTh,
  sortInsightRows,
  useInsightsTableSort,
} from "@/components/fpl/insights/insights-table-sort";

type PosSortKey =
  | "pos"
  | "compared"
  | "mae"
  | "rmse"
  | "bias"
  | "meanPred"
  | "meanAct";
type GwSortKey =
  | "gw"
  | "compared"
  | "mae"
  | "rmse"
  | "bias"
  | "corr"
  | "meanPred"
  | "meanAct";
type MissSortKey =
  | "player"
  | "team"
  | "pos"
  | "predicted"
  | "actual"
  | "error";

function fmtNum(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const prefix = v > 0 ? "+" : "";
  return `${prefix}${v.toFixed(d)}`;
}

function posSortValue(
  row: XpAccuracyPositionStats,
  key: PosSortKey,
): string | number | null {
  switch (key) {
    case "pos":
      return row.position;
    case "compared":
      return row.n;
    case "mae":
      return row.mae;
    case "rmse":
      return row.rmse;
    case "bias":
      return row.bias;
    case "meanPred":
      return row.mean_predicted;
    case "meanAct":
    default:
      return row.mean_actual;
  }
}

function gwSortValue(
  row: XpAccuracyGwSummary,
  key: GwSortKey,
): string | number | null {
  switch (key) {
    case "gw":
      return row.gw;
    case "compared":
      return row.compared;
    case "mae":
      return row.mae;
    case "rmse":
      return row.rmse;
    case "bias":
      return row.bias;
    case "corr":
      return row.correlation;
    case "meanPred":
      return row.mean_predicted;
    case "meanAct":
    default:
      return row.mean_actual;
  }
}

function missSortValue(
  row: XpAccuracyMiss,
  key: MissSortKey,
): string | number | null {
  switch (key) {
    case "player":
      return row.web_name;
    case "team":
      return row.team;
    case "pos":
      return row.position;
    case "predicted":
      return row.predicted;
    case "actual":
      return row.actual;
    case "error":
    default:
      return row.abs_error;
  }
}

export function XpAccuracyPanel({
  gws,
  aggregate,
  latestGw,
  topMisses,
  labels,
}: {
  gws: XpAccuracyGwSummary[];
  aggregate: {
    mae: number;
    rmse: number;
    bias: number;
    correlation: number | null;
    gw_count: number;
  } | null;
  latestGw: number | null;
  topMisses: XpAccuracyMiss[];
  labels: {
    intro: string;
    empty: string;
    cardMae: string;
    cardRmse: string;
    cardBias: string;
    cardCorr: string;
    cardGwCount: string;
    tabOverview: string;
    tabByGw: string;
    tabMisses: string;
    colGw: string;
    colCompared: string;
    colMae: string;
    colRmse: string;
    colBias: string;
    colCorr: string;
    colMeanPred: string;
    colMeanAct: string;
    colPos: string;
    colPlayer: string;
    colTeam: string;
    colPredicted: string;
    colActual: string;
    colError: string;
    colProfile: string;
    profileLink: string;
    missesTitle: string;
    positionBreakdown: string;
  };
}) {
  const [tab, setTab] = useState<"overview" | "byGw" | "misses">("overview");
  const [selectedGw, setSelectedGw] = useState<number | null>(
    latestGw ?? (gws[0]?.gw ?? null),
  );

  const posSort = useInsightsTableSort<PosSortKey>("mae", "asc");
  const gwSort = useInsightsTableSort<GwSortKey>("gw", "desc");
  const missSort = useInsightsTableSort<MissSortKey>("error");

  const selectedSummary = useMemo(
    () => gws.find((g) => g.gw === selectedGw) ?? null,
    [gws, selectedGw],
  );

  const sortedPositions = useMemo(() => {
    if (!selectedSummary) return [];
    return sortInsightRows(
      selectedSummary.by_position,
      (row) => posSortValue(row, posSort.sortKey),
      posSort.sortDir,
    );
  }, [selectedSummary, posSort.sortKey, posSort.sortDir]);

  const sortedGws = useMemo(
    () =>
      sortInsightRows(
        gws,
        (row) => gwSortValue(row, gwSort.sortKey),
        gwSort.sortDir,
      ),
    [gws, gwSort.sortKey, gwSort.sortDir],
  );

  const sortedMisses = useMemo(
    () =>
      sortInsightRows(
        topMisses,
        (row) => missSortValue(row, missSort.sortKey),
        missSort.sortDir,
      ),
    [topMisses, missSort.sortKey, missSort.sortDir],
  );

  if (gws.length === 0 || !aggregate) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{labels.intro}</p>
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: labels.tabOverview },
    { id: "byGw" as const, label: labels.tabByGw },
    { id: "misses" as const, label: labels.tabMisses },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{labels.intro}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={labels.cardMae} value={aggregate.mae.toFixed(2)} />
        <StatCard label={labels.cardRmse} value={aggregate.rmse.toFixed(2)} />
        <StatCard label={labels.cardBias} value={fmtNum(aggregate.bias)} />
        <StatCard
          label={labels.cardCorr}
          value={
            aggregate.correlation != null
              ? aggregate.correlation.toFixed(3)
              : "—"
          }
        />
        <StatCard
          label={labels.cardGwCount}
          value={String(aggregate.gw_count)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-medium text-brand-ink"
                : "rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && selectedSummary ? (
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {labels.colGw}
            <select
              value={selectedGw ?? ""}
              onChange={(e) => setSelectedGw(Number(e.target.value))}
              className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
            >
              {gws.map((g) => (
                <option key={g.gw} value={g.gw}>
                  GW{g.gw}
                </option>
              ))}
            </select>
          </label>
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            {labels.positionBreakdown}
          </h3>
          <div className="scroll-table mt-2">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <InsightsSortableTh
                    label={labels.colPos}
                    active={posSort.sortKey === "pos"}
                    dir={posSort.sortDir}
                    onSort={() => posSort.toggle("pos", "asc")}
                    className="px-2 py-2"
                  />
                  <InsightsSortableTh
                    label={labels.colCompared}
                    active={posSort.sortKey === "compared"}
                    dir={posSort.sortDir}
                    align="right"
                    onSort={() => posSort.toggle("compared")}
                    className="px-2 py-2"
                  />
                  <InsightsSortableTh
                    label={labels.colMae}
                    active={posSort.sortKey === "mae"}
                    dir={posSort.sortDir}
                    align="right"
                    onSort={() => posSort.toggle("mae", "asc")}
                    className="px-2 py-2"
                  />
                  <InsightsSortableTh
                    label={labels.colRmse}
                    active={posSort.sortKey === "rmse"}
                    dir={posSort.sortDir}
                    align="right"
                    onSort={() => posSort.toggle("rmse", "asc")}
                    className="px-2 py-2"
                  />
                  <InsightsSortableTh
                    label={labels.colBias}
                    active={posSort.sortKey === "bias"}
                    dir={posSort.sortDir}
                    align="right"
                    onSort={() => posSort.toggle("bias")}
                    className="px-2 py-2"
                  />
                  <InsightsSortableTh
                    label={labels.colMeanPred}
                    active={posSort.sortKey === "meanPred"}
                    dir={posSort.sortDir}
                    align="right"
                    onSort={() => posSort.toggle("meanPred")}
                    className="px-2 py-2"
                  />
                  <InsightsSortableTh
                    label={labels.colMeanAct}
                    active={posSort.sortKey === "meanAct"}
                    dir={posSort.sortDir}
                    align="right"
                    onSort={() => posSort.toggle("meanAct")}
                    className="px-2 py-2"
                  />
                </tr>
              </thead>
              <tbody>
                {sortedPositions.map((row) => (
                  <tr key={row.position} className="border-b border-border/60">
                    <td className="px-2 py-2">{row.position}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{row.n}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {row.mae.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {row.rmse.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {fmtNum(row.bias)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {row.mean_predicted.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {row.mean_actual.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "byGw" ? (
        <div className="scroll-table scroll-table--bordered scroll-table--muted">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <InsightsSortableTh
                  label={labels.colGw}
                  active={gwSort.sortKey === "gw"}
                  dir={gwSort.sortDir}
                  onSort={() => gwSort.toggle("gw")}
                />
                <InsightsSortableTh
                  label={labels.colCompared}
                  active={gwSort.sortKey === "compared"}
                  dir={gwSort.sortDir}
                  align="right"
                  onSort={() => gwSort.toggle("compared")}
                />
                <InsightsSortableTh
                  label={labels.colMae}
                  active={gwSort.sortKey === "mae"}
                  dir={gwSort.sortDir}
                  align="right"
                  onSort={() => gwSort.toggle("mae", "asc")}
                />
                <InsightsSortableTh
                  label={labels.colRmse}
                  active={gwSort.sortKey === "rmse"}
                  dir={gwSort.sortDir}
                  align="right"
                  onSort={() => gwSort.toggle("rmse", "asc")}
                />
                <InsightsSortableTh
                  label={labels.colBias}
                  active={gwSort.sortKey === "bias"}
                  dir={gwSort.sortDir}
                  align="right"
                  onSort={() => gwSort.toggle("bias")}
                />
                <InsightsSortableTh
                  label={labels.colCorr}
                  active={gwSort.sortKey === "corr"}
                  dir={gwSort.sortDir}
                  align="right"
                  onSort={() => gwSort.toggle("corr")}
                />
                <InsightsSortableTh
                  label={labels.colMeanPred}
                  active={gwSort.sortKey === "meanPred"}
                  dir={gwSort.sortDir}
                  align="right"
                  onSort={() => gwSort.toggle("meanPred")}
                />
                <InsightsSortableTh
                  label={labels.colMeanAct}
                  active={gwSort.sortKey === "meanAct"}
                  dir={gwSort.sortDir}
                  align="right"
                  onSort={() => gwSort.toggle("meanAct")}
                />
              </tr>
            </thead>
            <tbody>
              {sortedGws.map((row) => (
                <tr
                  key={row.gw}
                  className="border-b border-border/60 hover:bg-card/50"
                >
                  <td className="px-3 py-2 font-medium">GW{row.gw}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.compared}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.mae.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.rmse.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNum(row.bias)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.correlation != null ? row.correlation.toFixed(3) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.mean_predicted.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.mean_actual.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "misses" ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {labels.missesTitle.replace("{gw}", String(latestGw ?? "—"))}
          </h3>
          <div className="scroll-table scroll-table--bordered scroll-table--muted mt-2">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                  <InsightsSortableTh
                    label={labels.colPlayer}
                    active={missSort.sortKey === "player"}
                    dir={missSort.sortDir}
                    onSort={() => missSort.toggle("player", "asc")}
                  />
                  <InsightsSortableTh
                    label={labels.colTeam}
                    active={missSort.sortKey === "team"}
                    dir={missSort.sortDir}
                    onSort={() => missSort.toggle("team", "asc")}
                  />
                  <InsightsSortableTh
                    label={labels.colPos}
                    active={missSort.sortKey === "pos"}
                    dir={missSort.sortDir}
                    onSort={() => missSort.toggle("pos", "asc")}
                  />
                  <InsightsSortableTh
                    label={labels.colPredicted}
                    active={missSort.sortKey === "predicted"}
                    dir={missSort.sortDir}
                    align="right"
                    onSort={() => missSort.toggle("predicted")}
                  />
                  <InsightsSortableTh
                    label={labels.colActual}
                    active={missSort.sortKey === "actual"}
                    dir={missSort.sortDir}
                    align="right"
                    onSort={() => missSort.toggle("actual")}
                  />
                  <InsightsSortableTh
                    label={labels.colError}
                    active={missSort.sortKey === "error"}
                    dir={missSort.sortDir}
                    align="right"
                    onSort={() => missSort.toggle("error")}
                  />
                  <th className="px-3 py-2">{labels.colProfile}</th>
                </tr>
              </thead>
              <tbody>
                {sortedMisses.map((row) => (
                  <tr
                    key={row.fpl_id}
                    className="border-b border-border/60 hover:bg-card/50"
                  >
                    <td className="px-3 py-2 font-medium">{row.web_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.team}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.position ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.predicted.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.actual}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-amber-400">
                      {fmtNum(row.error, 1)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/player/${row.fpl_id}`}
                        className="text-brand-accent no-underline hover:underline"
                      >
                        {labels.profileLink}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
