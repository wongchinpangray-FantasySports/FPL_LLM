"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ValueBandRow,
  ValueBandTakeaway,
} from "@/lib/fpl/insights/value-bands";
import {
  InsightsSortableTh,
  sortInsightRows,
  useInsightsTableSort,
} from "@/components/fpl/insights/insights-table-sort";
import {
  FplPlayerPerformanceModal,
  type PlayerPerformanceProfile,
} from "@/components/fpl/insights/fpl-player-performance-modal";

type SortKey =
  | "player"
  | "team"
  | "price"
  | "own"
  | "xp"
  | "mins"
  | "threat"
  | "defcon90"
  | "preG"
  | "value";

function fmtNum(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

function sortValue(row: ValueBandRow, key: SortKey): string | number | null {
  switch (key) {
    case "player":
      return row.web_name;
    case "team":
      return row.team;
    case "price":
      return row.price;
    case "own":
      return row.ownership;
    case "mins":
      return row.expected_minutes_next;
    case "threat":
      return row.threat;
    case "defcon90":
      return row.defensive_contribution_per_90;
    case "preG":
      return row.preseason_goals;
    case "value":
      return row.value_per_million;
    case "xp":
    default:
      return row.xp_total;
  }
}

export function ValueBandPanel({
  rows,
  takeaways,
  assessed,
  horizon,
  locale,
  labels,
}: {
  rows: ValueBandRow[];
  takeaways: ValueBandTakeaway[];
  assessed: number;
  horizon: number;
  locale: string;
  labels: {
    intro: string;
    takeawaysTitle: string;
    assessed: string;
    colPlayer: string;
    colTeam: string;
    colPrice: string;
    colOwn: string;
    colXp: string;
    colMins: string;
    colThreat: string;
    colDefcon90: string;
    colPreG: string;
    colValue: string;
    colProfile: string;
    profileLink: string;
    empty: string;
  };
}) {
  const tPlayer = useTranslations("playerPage");
  const tModal = useTranslations("fplInsights.playerModal");
  const { sortKey, sortDir, toggle } = useInsightsTableSort<SortKey>("xp");
  const sorted = useMemo(
    () => sortInsightRows(rows, (row) => sortValue(row, sortKey), sortDir),
    [rows, sortKey, sortDir],
  );
  const zh = locale.toLowerCase().startsWith("zh");

  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerPerformanceProfile | null>(null);

  const openProfile = useCallback(
    async (fplId: number) => {
      setOpenId(fplId);
      setLoading(true);
      setError(null);
      setDetail(null);
      try {
        const res = await fetch(
          `/api/player/${fplId}/profile?horizon=${horizon}`,
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error || tModal("error"));
        }
        const data = (await res.json()) as PlayerPerformanceProfile;
        setDetail(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : tModal("error"));
      } finally {
        setLoading(false);
      }
    },
    [horizon, tModal],
  );

  const closeProfile = useCallback(() => {
    setOpenId(null);
    setError(null);
    setDetail(null);
    setLoading(false);
  }, []);

  const modalLabels = useMemo(
    () => ({
      close: tModal("close"),
      loading: tModal("loading"),
      error: tModal("error"),
      openFullProfile: tModal("openFullProfile"),
      price: tPlayer("price"),
      form: tPlayer("form"),
      ownership: tPlayer("ownership"),
      status: tPlayer("status"),
      xpHorizon: tPlayer("xpHorizon"),
      valueXm: tPlayer("valueXm"),
      news: tPlayer("news"),
      seasonSection: tPlayer("seasonSection"),
      totalPts: tPlayer("totalPts"),
      minutes: tPlayer("minutes"),
      goalsAssists: tPlayer("goalsAssists"),
      cleanSheets: tPlayer("cleanSheets"),
      ict: tPlayer("ict"),
      threat: tModal("threat"),
      defcon: tModal("defcon"),
      ppg: tModal("ppg"),
      recentTitle: tModal("recentTitle"),
      fixturesTitle: tModal("fixturesTitle"),
      colGw: tPlayer("tblGw"),
      colOpp: tPlayer("tblOpp"),
      colMins: tPlayer("tblMins"),
      colPts: tModal("colPts"),
      colXp: tPlayer("tblXp"),
      emptyGw: tModal("emptyGw"),
      shotMap: {
        title: tModal("shotMapTitle"),
        subtitle: tModal("shotMapSubtitle"),
        empty: tModal("shotMapEmpty"),
        legendGoal: tModal("shotMapLegendGoal"),
        legendSaved: tModal("shotMapLegendSaved"),
        legendOther: tModal("shotMapLegendOther"),
        legendSize: tModal("shotMapLegendSize"),
        statShots: tModal("shotMapStatShots"),
        statGoals: tModal("shotMapStatGoals"),
        statXg: tModal("shotMapStatXg"),
        statOnTarget: tModal("shotMapStatOnTarget"),
        sourceNote: tModal("shotMapSource"),
      },
    }),
    [tModal, tPlayer],
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{labels.intro}</p>
      <p className="text-xs text-muted-foreground">{labels.assessed}</p>

      {takeaways.length > 0 ? (
        <section className="rounded-xl border border-border bg-card/50 p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
            {labels.takeawaysTitle}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {takeaways.map((t) => (
              <li
                key={`${t.kind}-${t.fpl_id}`}
                className="text-sm text-foreground/90"
              >
                <button
                  type="button"
                  onClick={() => void openProfile(t.fpl_id)}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {t.web_name}
                </button>
                <span className="text-muted-foreground"> · {t.team} — </span>
                {zh ? t.blurb_zh : t.blurb_en}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="scroll-table scroll-table--bordered scroll-table--muted">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <InsightsSortableTh
                  label={labels.colPlayer}
                  active={sortKey === "player"}
                  dir={sortDir}
                  onSort={() => toggle("player")}
                />
                <InsightsSortableTh
                  label={labels.colTeam}
                  active={sortKey === "team"}
                  dir={sortDir}
                  onSort={() => toggle("team")}
                />
                <InsightsSortableTh
                  label={labels.colPrice}
                  active={sortKey === "price"}
                  dir={sortDir}
                  onSort={() => toggle("price")}
                />
                <InsightsSortableTh
                  label={labels.colOwn}
                  active={sortKey === "own"}
                  dir={sortDir}
                  onSort={() => toggle("own")}
                />
                <InsightsSortableTh
                  label={labels.colXp}
                  active={sortKey === "xp"}
                  dir={sortDir}
                  onSort={() => toggle("xp")}
                />
                <InsightsSortableTh
                  label={labels.colMins}
                  active={sortKey === "mins"}
                  dir={sortDir}
                  onSort={() => toggle("mins")}
                />
                <InsightsSortableTh
                  label={labels.colThreat}
                  active={sortKey === "threat"}
                  dir={sortDir}
                  onSort={() => toggle("threat")}
                />
                <InsightsSortableTh
                  label={labels.colDefcon90}
                  active={sortKey === "defcon90"}
                  dir={sortDir}
                  onSort={() => toggle("defcon90")}
                />
                <InsightsSortableTh
                  label={labels.colPreG}
                  active={sortKey === "preG"}
                  dir={sortDir}
                  onSort={() => toggle("preG")}
                />
                <InsightsSortableTh
                  label={labels.colValue}
                  active={sortKey === "value"}
                  dir={sortDir}
                  onSort={() => toggle("value")}
                />
                <th className="px-3 py-2 font-medium">{labels.colProfile}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.fpl_id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/20"
                >
                  <td className="px-3 py-2 font-medium text-foreground">
                    <button
                      type="button"
                      onClick={() => void openProfile(row.fpl_id)}
                      className="text-left hover:text-brand-accent hover:underline"
                    >
                      {row.web_name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.team}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.price != null ? `£${row.price.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.ownership != null
                      ? `${fmtNum(row.ownership, 1)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {fmtNum(row.xp_total, 1)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtNum(row.expected_minutes_next, 0)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtNum(row.threat, 1)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtNum(row.defensive_contribution_per_90, 1)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.preseason_goals > 0 ? row.preseason_goals : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtNum(row.value_per_million, 2)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void openProfile(row.fpl_id)}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {labels.profileLink}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FplPlayerPerformanceModal
        open={openId != null}
        loading={loading}
        error={error}
        detail={detail}
        labels={modalLabels}
        onClose={closeProfile}
      />
    </div>
  );
}
