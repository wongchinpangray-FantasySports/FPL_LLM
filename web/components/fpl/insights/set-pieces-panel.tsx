"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { SetPieceTeamGroup } from "@/lib/fpl/insights/set-pieces";

function orderLabel(order: number | null, note: string | null): string {
  if (order == null) return "—";
  if (order === 1) return note?.trim() || "1st";
  if (order === 2) return note?.trim() || "2nd";
  return note?.trim() || `${order}`;
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
    colProfile: string;
    profileLink: string;
    empty: string;
    primaryOnly: string;
    showAll: string;
  };
}) {
  const [teamFilter, setTeamFilter] = useState("all");
  const [primaryOnly, setPrimaryOnly] = useState(true);

  const filtered = useMemo(() => {
    let list = teams;
    if (teamFilter !== "all") {
      list = list.filter((g) => g.team === teamFilter);
    }
    if (!primaryOnly) return list;
    return list.map((g) => ({
      ...g,
      rows: g.rows.filter(
        (r) =>
          r.penalties_order === 1 ||
          r.direct_freekicks_order === 1 ||
          r.corners_order === 1 ||
          (r.penalties_order != null && r.penalties_order <= 2) ||
          (r.direct_freekicks_order != null && r.direct_freekicks_order <= 2) ||
          (r.corners_order != null && r.corners_order <= 2),
      ),
    })).filter((g) => g.rows.length > 0);
  }, [teams, teamFilter, primaryOnly]);

  const teamNames = useMemo(() => teams.map((g) => g.team).sort(), [teams]);

  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

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
            {teamNames.map((t) => (
              <option key={t} value={t}>
                {t}
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
        {filtered.map((group) => (
          <section
            key={group.team}
            className="overflow-hidden rounded-xl border border-border"
          >
            <h3 className="border-b border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground">
              {group.team}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">{labels.colPlayer}</th>
                    <th className="px-3 py-2">{labels.colPos}</th>
                    <th className="px-3 py-2">{labels.colPen}</th>
                    <th className="px-3 py-2">{labels.colFk}</th>
                    <th className="px-3 py-2">{labels.colCorners}</th>
                    <th className="px-3 py-2">{labels.colProfile}</th>
                  </tr>
                </thead>
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
                          "px-3 py-2 tabular-nums",
                          row.penalties_order === 1 && "font-medium text-brand-accent",
                        )}
                      >
                        {orderLabel(row.penalties_order, row.penalties_note)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 tabular-nums",
                          row.direct_freekicks_order === 1 &&
                            "font-medium text-brand-accent",
                        )}
                      >
                        {orderLabel(row.direct_freekicks_order, row.freekicks_note)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 tabular-nums",
                          row.corners_order === 1 && "font-medium text-brand-accent",
                        )}
                      >
                        {orderLabel(row.corners_order, row.corners_note)}
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
