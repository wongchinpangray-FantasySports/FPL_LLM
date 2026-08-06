"use client";

import { useMemo } from "react";
import { Link } from "@/i18n/navigation";
import type {
  ValueBandRow,
  ValueBandTakeaway,
} from "@/lib/fpl/insights/value-bands";
import {
  InsightsSortableTh,
  sortInsightRows,
  useInsightsTableSort,
} from "@/components/fpl/insights/insights-table-sort";

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
  const { sortKey, sortDir, toggle } = useInsightsTableSort<SortKey>("xp");
  const sorted = useMemo(
    () => sortInsightRows(rows, (row) => sortValue(row, sortKey), sortDir),
    [rows, sortKey, sortDir],
  );
  const zh = locale.toLowerCase().startsWith("zh");

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        {labels.intro
          .replace("{n}", String(assessed))
          .replace("{horizon}", String(horizon))}
      </p>
      <p className="text-xs text-muted-foreground">{labels.assessed.replace("{n}", String(assessed))}</p>

      {takeaways.length > 0 ? (
        <section className="rounded-xl border border-border bg-card/50 p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground">
            {labels.takeawaysTitle}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {takeaways.map((t) => (
              <li key={`${t.kind}-${t.fpl_id}`} className="text-sm text-foreground/90">
                <Link
                  href={`/fpl/player/${t.fpl_id}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {t.web_name}
                </Link>
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
        <div className="overflow-x-auto rounded-xl border border-border">
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
                    {row.web_name}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.team}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.price != null ? `£${row.price.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.ownership != null ? `${fmtNum(row.ownership, 1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {fmtNum(row.xp_total, 1)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtNum(row.expected_minutes_next, 0)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(row.threat, 1)}</td>
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
                    <Link
                      href={`/fpl/player/${row.fpl_id}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {labels.profileLink}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
