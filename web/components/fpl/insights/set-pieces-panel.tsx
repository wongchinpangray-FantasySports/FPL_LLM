"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  formatSetPieceOrdinal,
  formatSetPieceRole,
  hasPrimaryOrBackupRole,
  type SetPieceTeamGroup,
} from "@/lib/fpl/insights/set-pieces";
import {
  InsightsSortableTh,
  sortInsightRows,
  useInsightsTableSort,
} from "@/components/fpl/insights/insights-table-sort";

type SortKey = "player" | "pos" | "pen" | "fk" | "corners" | "xg90" | "xa90";

type SetPieceRow = SetPieceTeamGroup["rows"][number];

function fmtNum(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

function setPieceSortValue(
  row: SetPieceRow,
  key: SortKey,
): string | number | null {
  switch (key) {
    case "player":
      return row.web_name;
    case "pos":
      return row.position;
    case "pen":
      return row.penalties_order;
    case "fk":
      return row.direct_freekicks_order;
    case "corners":
      return row.corners_order;
    case "xg90":
      return row.xg_per_90;
    case "xa90":
      return row.xa_per_90;
    default:
      return row.corners_order;
  }
}

function isPrimaryRole(order: number | null): boolean {
  return order === 1;
}

export function SetPiecesPanel({
  teams,
  labels,
}: {
  teams: SetPieceTeamGroup[];
  labels: {
    intro: string;
    filterTeam: string;
    filterAll: string;
    colPlayer: string;
    colPos: string;
    colPen: string;
    colFk: string;
    colCorners: string;
    colXg90: string;
    colXa90: string;
    colProfile: string;
    profileLink: string;
    empty: string;
    primaryOnly: string;
    showAll: string;
    rolePrimary: string;
    roleBackup: string;
  };
}) {
  const locale = useLocale();
  const [teamFilter, setTeamFilter] = useState("all");
  const [primaryOnly, setPrimaryOnly] = useState(true);
  const { sortKey, sortDir, toggle } = useInsightsTableSort<SortKey>(
    "pen",
    "asc",
  );

  const roleLabels = useMemo(
    () => ({
      primary: labels.rolePrimary,
      backup: labels.roleBackup,
      ordinal: (order: number) => formatSetPieceOrdinal(order, locale),
    }),
    [labels.roleBackup, labels.rolePrimary, locale],
  );

  const filtered = useMemo(() => {
    let list = teams;
    if (teamFilter !== "all") {
      list = list.filter((g) => g.team === teamFilter);
    }
    if (!primaryOnly) return list;
    return list
      .map((g) => ({
        ...g,
        rows: g.rows.filter(hasPrimaryOrBackupRole),
      }))
      .filter((g) => g.rows.length > 0);
  }, [teams, teamFilter, primaryOnly]);

  const sortedGroups = useMemo(
    () =>
      filtered.map((group) => ({
        ...group,
        rows: sortInsightRows(
          group.rows,
          (row) => setPieceSortValue(row, sortKey),
          sortDir,
        ),
      })),
    [filtered, sortKey, sortDir],
  );

  const teamNames = useMemo(() => teams.map((g) => g.team).sort(), [teams]);

  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  const headerRow = (
    <tr className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
      <InsightsSortableTh
        label={labels.colPlayer}
        active={sortKey === "player"}
        dir={sortDir}
        onSort={() => toggle("player", "asc")}
        className="px-3 py-2"
      />
      <InsightsSortableTh
        label={labels.colPos}
        active={sortKey === "pos"}
        dir={sortDir}
        onSort={() => toggle("pos", "asc")}
        className="px-3 py-2"
      />
      <InsightsSortableTh
        label={labels.colPen}
        active={sortKey === "pen"}
        dir={sortDir}
        onSort={() => toggle("pen", "asc")}
        className="px-3 py-2"
      />
      <InsightsSortableTh
        label={labels.colFk}
        active={sortKey === "fk"}
        dir={sortDir}
        onSort={() => toggle("fk", "asc")}
        className="px-3 py-2"
      />
      <InsightsSortableTh
        label={labels.colCorners}
        active={sortKey === "corners"}
        dir={sortDir}
        onSort={() => toggle("corners", "asc")}
        className="px-3 py-2"
      />
      <InsightsSortableTh
        label={labels.colXg90}
        active={sortKey === "xg90"}
        dir={sortDir}
        align="right"
        onSort={() => toggle("xg90")}
        className="px-3 py-2"
      />
      <InsightsSortableTh
        label={labels.colXa90}
        active={sortKey === "xa90"}
        dir={sortDir}
        align="right"
        onSort={() => toggle("xa90")}
        className="px-3 py-2"
      />
      <th className="px-3 py-2">{labels.colProfile}</th>
    </tr>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{labels.intro}</p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {labels.filterTeam}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
          >
            <option value="all">{labels.filterAll}</option>
            {teamNames.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={primaryOnly}
            onChange={(e) => setPrimaryOnly(e.target.checked)}
            className="rounded border-border"
          />
          {primaryOnly ? labels.primaryOnly : labels.showAll}
        </label>
      </div>

      <div className="flex flex-col gap-4">
        {sortedGroups.map((group) => (
          <section
            key={group.team}
            className="rounded-xl border border-border"
          >
            <h3 className="border-b border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground">
              {group.team}
            </h3>
            <div className="scroll-table">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>{headerRow}</thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr
                      key={row.fpl_id}
                      className="border-b border-border/40 hover:bg-card/50"
                    >
                      <td className="px-3 py-2 font-medium text-foreground">
                        {row.web_name}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.position ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2",
                          isPrimaryRole(row.penalties_order) &&
                            "font-medium text-brand-accent",
                        )}
                      >
                        {formatSetPieceRole(
                          row.penalties_order,
                          !primaryOnly,
                          roleLabels,
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2",
                          isPrimaryRole(row.direct_freekicks_order) &&
                            "font-medium text-brand-accent",
                        )}
                      >
                        {formatSetPieceRole(
                          row.direct_freekicks_order,
                          !primaryOnly,
                          roleLabels,
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2",
                          isPrimaryRole(row.corners_order) &&
                            "font-medium text-brand-accent",
                        )}
                      >
                        {formatSetPieceRole(
                          row.corners_order,
                          !primaryOnly,
                          roleLabels,
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtNum(row.xg_per_90)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtNum(row.xa_per_90)}
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
          </section>
        ))}
      </div>
    </div>
  );
}
