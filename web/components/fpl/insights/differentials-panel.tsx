"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { DifferentialRow } from "@/lib/fpl/insights/differentials";
import {
  InsightsSortableTh,
  sortInsightRows,
  useInsightsTableSort,
} from "@/components/fpl/insights/insights-table-sort";

type SortKey =
  | "player"
  | "team"
  | "pos"
  | "price"
  | "own"
  | "form"
  | "xp"
  | "xpGw"
  | "value";

const POS_ORDER = ["GKP", "DEF", "MID", "FWD"] as const;

function fmtNum(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

function differentialSortValue(
  row: DifferentialRow,
  key: SortKey,
): string | number | null {
  switch (key) {
    case "player":
      return row.web_name;
    case "team":
      return row.team;
    case "pos":
      return row.position;
    case "price":
      return row.price;
    case "own":
      return row.ownership;
    case "form":
      return row.form;
    case "xpGw":
      return row.xp_per_game;
    case "value":
      return row.value_per_million;
    case "xp":
    default:
      return row.xp_total;
  }
}

function Table({
  rows,
  sortKey,
  sortDir,
  toggle,
  labels,
  hidePosCol,
}: {
  rows: DifferentialRow[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  toggle: (key: SortKey, defaultDir?: "asc" | "desc") => void;
  labels: {
    colPlayer: string;
    colTeam: string;
    colPos: string;
    colPrice: string;
    colOwn: string;
    colForm: string;
    colXp: string;
    colXpGw: string;
    colValue: string;
    colFixtures: string;
    colProfile: string;
    profileLink: string;
  };
  hidePosCol?: boolean;
}) {
  return (
    <div className="scroll-table scroll-table--bordered scroll-table--muted">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-card text-xs uppercase tracking-wider text-muted-foreground">
            <InsightsSortableTh
              label={labels.colPlayer}
              active={sortKey === "player"}
              dir={sortDir}
              onSort={() => toggle("player", "asc")}
            />
            <InsightsSortableTh
              label={labels.colTeam}
              active={sortKey === "team"}
              dir={sortDir}
              onSort={() => toggle("team", "asc")}
            />
            {!hidePosCol ? (
              <InsightsSortableTh
                label={labels.colPos}
                active={sortKey === "pos"}
                dir={sortDir}
                onSort={() => toggle("pos", "asc")}
              />
            ) : null}
            <InsightsSortableTh
              label={labels.colPrice}
              active={sortKey === "price"}
              dir={sortDir}
              align="right"
              onSort={() => toggle("price")}
            />
            <InsightsSortableTh
              label={labels.colOwn}
              active={sortKey === "own"}
              dir={sortDir}
              align="right"
              onSort={() => toggle("own")}
            />
            <InsightsSortableTh
              label={labels.colForm}
              active={sortKey === "form"}
              dir={sortDir}
              align="right"
              onSort={() => toggle("form")}
            />
            <InsightsSortableTh
              label={labels.colXp}
              active={sortKey === "xp"}
              dir={sortDir}
              align="right"
              onSort={() => toggle("xp")}
            />
            <InsightsSortableTh
              label={labels.colXpGw}
              active={sortKey === "xpGw"}
              dir={sortDir}
              align="right"
              onSort={() => toggle("xpGw")}
            />
            <InsightsSortableTh
              label={labels.colValue}
              active={sortKey === "value"}
              dir={sortDir}
              align="right"
              onSort={() => toggle("value")}
            />
            <th className="px-3 py-2">{labels.colFixtures}</th>
            <th className="px-3 py-2">{labels.colProfile}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.fpl_id}
              className="border-b border-border/60 hover:bg-card/50"
            >
              <td className="px-3 py-2 font-medium text-foreground">
                {row.web_name}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{row.team}</td>
              {!hidePosCol ? (
                <td className="px-3 py-2 text-muted-foreground">
                  {row.position ?? "—"}
                </td>
              ) : null}
              <td className="px-3 py-2 text-right tabular-nums">
                £{fmtNum(row.price)}m
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtNum(row.ownership)}%
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtNum(row.form)}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-brand-accent">
                {fmtNum(row.xp_total, 1)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtNum(row.xp_per_game, 1)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtNum(row.value_per_million, 2)}
              </td>
              <td className="max-w-[220px] px-3 py-2 text-xs text-muted-foreground">
                {row.fixtures
                  .slice(0, 5)
                  .map((f) => {
                    const ha = f.home ? "H" : "A";
                    return `GW${f.gw} ${f.opp} (${ha}) ${fmtNum(f.xp, 1)}`;
                  })
                  .join(" · ")}
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
  );
}

export function DifferentialsPanel({
  rows,
  labels,
}: {
  rows: DifferentialRow[];
  horizon?: number;
  maxOwnership?: number;
  labels: {
    intro: string;
    filterPos: string;
    posAll: string;
    posGkp: string;
    posDef: string;
    posMid: string;
    posFwd: string;
    groupGkp: string;
    groupDef: string;
    groupMid: string;
    groupFwd: string;
    colPlayer: string;
    colTeam: string;
    colPos: string;
    colPrice: string;
    colOwn: string;
    colForm: string;
    colXp: string;
    colXpGw: string;
    colValue: string;
    colFixtures: string;
    colProfile: string;
    profileLink: string;
    empty: string;
    fixtureHome: string;
    fixtureAway: string;
  };
}) {
  const [position, setPosition] = useState("all");
  const { sortKey, sortDir, toggle } = useInsightsTableSort<SortKey>("xp");

  const groups = useMemo(() => {
    const sorted = sortInsightRows(
      rows,
      (row) => differentialSortValue(row, sortKey),
      sortDir,
    );
    const labelFor = (pos: string) => {
      switch (pos) {
        case "GKP":
          return labels.groupGkp;
        case "DEF":
          return labels.groupDef;
        case "MID":
          return labels.groupMid;
        case "FWD":
          return labels.groupFwd;
        default:
          return pos;
      }
    };
    if (position !== "all") {
      return [
        {
          key: position,
          label: labelFor(position),
          rows: sorted.filter((r) => r.position === position),
        },
      ];
    }
    return POS_ORDER.map((pos) => ({
      key: pos,
      label: labelFor(pos),
      rows: sorted.filter((r) => r.position === pos),
    })).filter((g) => g.rows.length > 0);
  }, [rows, position, sortKey, sortDir, labels]);

  const empty = groups.every((g) => g.rows.length === 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{labels.intro}</p>

      <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
        {labels.filterPos}
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
        >
          <option value="all">{labels.posAll}</option>
          <option value="GKP">{labels.posGkp}</option>
          <option value="DEF">{labels.posDef}</option>
          <option value="MID">{labels.posMid}</option>
          <option value="FWD">{labels.posFwd}</option>
        </select>
      </label>

      {empty ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.key} className="flex flex-col gap-3">
              {position === "all" ? (
                <h2 className="text-sm font-semibold tracking-wide text-brand-accent">
                  {g.label}
                  <span className="ml-2 font-normal text-muted-foreground">
                    ({g.rows.length})
                  </span>
                </h2>
              ) : null}
              <Table
                rows={g.rows}
                sortKey={sortKey}
                sortDir={sortDir}
                toggle={toggle}
                labels={labels}
                hidePosCol={position !== "all"}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
