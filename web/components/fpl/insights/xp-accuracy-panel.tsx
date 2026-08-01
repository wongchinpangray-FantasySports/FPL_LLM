"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type {
  XpAccuracyGwSummary,
  XpAccuracyMiss,
} from "@/lib/fpl/insights/xp-accuracy";

function fmtNum(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const prefix = v > 0 ? "+" : "";
  return `${prefix}${v.toFixed(d)}`;
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

  const selectedSummary = useMemo(
    () => gws.find((g) => g.gw === selectedGw) ?? null,
    [gws, selectedGw],
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
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2">{labels.colPos}</th>
                  <th className="px-2 py-2 text-right">{labels.colCompared}</th>
                  <th className="px-2 py-2 text-right">{labels.colMae}</th>
                  <th className="px-2 py-2 text-right">{labels.colRmse}</th>
                  <th className="px-2 py-2 text-right">{labels.colBias}</th>
                  <th className="px-2 py-2 text-right">{labels.colMeanPred}</th>
                  <th className="px-2 py-2 text-right">{labels.colMeanAct}</th>
                </tr>
              </thead>
              <tbody>
                {selectedSummary.by_position.map((row) => (
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
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">{labels.colGw}</th>
                <th className="px-3 py-2 text-right">{labels.colCompared}</th>
                <th className="px-3 py-2 text-right">{labels.colMae}</th>
                <th className="px-3 py-2 text-right">{labels.colRmse}</th>
                <th className="px-3 py-2 text-right">{labels.colBias}</th>
                <th className="px-3 py-2 text-right">{labels.colCorr}</th>
                <th className="px-3 py-2 text-right">{labels.colMeanPred}</th>
                <th className="px-3 py-2 text-right">{labels.colMeanAct}</th>
              </tr>
            </thead>
            <tbody>
              {gws.map((row) => (
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
          <div className="mt-2 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">{labels.colPlayer}</th>
                  <th className="px-3 py-2">{labels.colTeam}</th>
                  <th className="px-3 py-2">{labels.colPos}</th>
                  <th className="px-3 py-2 text-right">{labels.colPredicted}</th>
                  <th className="px-3 py-2 text-right">{labels.colActual}</th>
                  <th className="px-3 py-2 text-right">{labels.colError}</th>
                  <th className="px-3 py-2">{labels.colProfile}</th>
                </tr>
              </thead>
              <tbody>
                {topMisses.map((row) => (
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
