"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type BrowsePlayer = {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
  total_points: number | null;
  last_season_points: number | null;
  selected_by_percent: number | null;
  form: number | null;
};

export type PanelProjRow = {
  xp_next_gw?: number;
  by_gw?: { gw: number; xp: number }[];
};

type TeamOption = { id: number; short_name: string; name: string };

type SortKey = "price" | "points" | "ownership" | "form" | "xpts";

function xpForGw(row: PanelProjRow | undefined, gw: number): number | null {
  if (!row) return null;
  const cell = row.by_gw?.find((c) => c.gw === gw);
  if (cell?.xp != null && Number.isFinite(cell.xp)) return cell.xp;
  if (row.xp_next_gw != null && Number.isFinite(row.xp_next_gw)) {
    return row.xp_next_gw;
  }
  return null;
}

export function SquadBuilderPlayerPanel({
  selectedSlot,
  slotPosition,
  bank,
  planningGw,
  projById,
  squadFplIds,
  teams,
  onPickPlayer,
  labels,
}: {
  selectedSlot: number | null;
  slotPosition: string | null;
  bank: number;
  planningGw: number;
  projById: Record<string, PanelProjRow>;
  squadFplIds: Set<number>;
  teams: TeamOption[];
  onPickPlayer: (player: BrowsePlayer) => void;
  labels: {
    title: string;
    search: string;
    positionAll: string;
    clubAll: string;
    sortPrice: string;
    sortPoints: string;
    sortOwnership: string;
    sortForm: string;
    sortXpts: string;
    colName: string;
    colOwn: string;
    colPrice: string;
    colLastSeason: string;
    colXpts: string;
    inSquad: string;
    loading: string;
    empty: string;
    updatedAt: string;
  };
}) {
  const t = useTranslations("squadBuilderApp");
  const [position, setPosition] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("price");
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState<BrowsePlayer[]>([]);
  const [lastSeasonKey, setLastSeasonKey] = useState<string | null>(null);
  const [panelProj, setPanelProj] = useState<Record<string, PanelProjRow>>({});
  const [loading, setLoading] = useState(false);
  const [projLoading, setProjLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (slotPosition) setPosition(slotPosition);
  }, [slotPosition, selectedSlot]);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort: sort === "xpts" ? "price" : sort,
        limit: "80",
      });
      if (q.trim()) params.set("q", q.trim());
      if (position) params.set("position", position);
      if (teamId) params.set("team_id", teamId);
      const res = await fetch(`/api/squad-builder/players?${params}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        players?: BrowsePlayer[];
        lastSeasonKey?: string | null;
        source?: string;
        error?: string;
      };
      if (!res.ok) {
        setPlayers([]);
        return;
      }
      setPlayers(data.players ?? []);
      setLastSeasonKey(data.lastSeasonKey ?? null);
      setUpdatedAt(Date.now());
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [q, position, teamId, sort]);

  useEffect(() => {
    const timer = setTimeout(() => void loadPlayers(), 200);
    return () => clearTimeout(timer);
  }, [loadPlayers]);

  const loadProjections = useCallback(async (ids: number[]) => {
    if (ids.length === 0) {
      setPanelProj({});
      return;
    }
    setProjLoading(true);
    try {
      const res = await fetch("/api/squad-builder/projections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          playerIds: ids,
          fromGw: planningGw,
          horizon: 1,
        }),
      });
      const data = (await res.json()) as {
        projections?: Record<string, PanelProjRow>;
      };
      setPanelProj(data.projections ?? {});
    } catch {
      setPanelProj({});
    } finally {
      setProjLoading(false);
    }
  }, [planningGw]);

  useEffect(() => {
    const ids = players.map((p) => p.fpl_id).filter((id) => id > 0);
    const timer = setTimeout(() => void loadProjections(ids), 250);
    return () => clearTimeout(timer);
  }, [players, loadProjections]);

  const mergedProj = useMemo(() => ({ ...projById, ...panelProj }), [
    projById,
    panelProj,
  ]);

  const sortedPlayers = useMemo(() => {
    if (sort !== "xpts") return players;
    return [...players].sort((a, b) => {
      const ax = xpForGw(mergedProj[String(a.fpl_id)], planningGw) ?? -1;
      const bx = xpForGw(mergedProj[String(b.fpl_id)], planningGw) ?? -1;
      return bx - ax;
    });
  }, [players, sort, mergedProj, planningGw]);

  const sortLabels: Record<SortKey, string> = {
    price: labels.sortPrice,
    points: labels.sortPoints,
    ownership: labels.sortOwnership,
    form: labels.sortForm,
    xpts: labels.sortXpts,
  };

  const showLoading = loading || (projLoading && sortedPlayers.length === 0);

  return (
    <aside className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-6rem)]">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
          {updatedAt ? (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {labels.updatedAt}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("panelSlotHint", {
            slot: selectedSlot != null ? selectedSlot : "–",
          })}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {t("panelGwHint", { gw: planningGw })}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {t("panelSortHint", { sort: sortLabels[sort] })}
        </p>
        {lastSeasonKey ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {t("panelLastSeasonHint", {
              season: lastSeasonKey,
              next: String(Number(lastSeasonKey) + 1).slice(-2),
            })}
          </p>
        ) : null}
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={labels.search}
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        >
          <option value="">{labels.positionAll}</option>
          {["GKP", "DEF", "MID", "FWD"].map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
        >
          <option value="">{labels.clubAll}</option>
          {teams.map((team) => (
            <option key={team.id} value={String(team.id)}>
              {team.short_name}
            </option>
          ))}
        </select>
      </div>

      <select
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
        value={sort}
        onChange={(e) => setSort(e.target.value as SortKey)}
      >
        <option value="price">{labels.sortPrice}</option>
        <option value="points">{labels.sortPoints}</option>
        <option value="ownership">{labels.sortOwnership}</option>
        <option value="form">{labels.sortForm}</option>
        <option value="xpts">{labels.sortXpts}</option>
      </select>

      <div className="min-h-[320px] flex-1 overflow-y-auto rounded-lg border border-border/60 lg:min-h-0">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-[1] bg-card">
            <tr className="border-b border-border text-[9px] uppercase text-muted-foreground">
              <th className="px-2 py-2 text-left">{labels.colName}</th>
              <th className="px-1 py-2 text-right">{labels.colOwn}</th>
              <th className="px-1 py-2 text-right">{labels.colPrice}</th>
              <th className="px-1 py-2 text-right">{labels.colLastSeason}</th>
              <th className="px-1 py-2 text-right">{labels.colXpts}</th>
            </tr>
          </thead>
          <tbody>
            {showLoading && sortedPlayers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                  {labels.loading}
                </td>
              </tr>
            ) : sortedPlayers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                  {labels.empty}
                </td>
              </tr>
            ) : (
              sortedPlayers.map((p) => {
                const inSquad = squadFplIds.has(p.fpl_id);
                const pr = mergedProj[String(p.fpl_id)];
                const xpt = xpForGw(pr, planningGw);
                return (
                  <tr
                    key={p.fpl_id}
                    className={cn(
                      "border-b border-border/40 transition-colors",
                      inSquad
                        ? "cursor-not-allowed opacity-40"
                        : "cursor-pointer hover:bg-muted/40",
                    )}
                    onClick={() => {
                      if (!inSquad) onPickPlayer(p);
                    }}
                    title={inSquad ? labels.inSquad : undefined}
                  >
                    <td className="px-2 py-2">
                      <div className="font-medium text-foreground">
                        {p.web_name ?? p.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.team} · {p.position}
                      </div>
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums text-muted-foreground">
                      {p.selected_by_percent != null
                        ? `${Number(p.selected_by_percent).toFixed(1)}%`
                        : "–"}
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums">
                      £{(p.base_price ?? 0).toFixed(1)}
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums text-muted-foreground">
                      {p.last_season_points != null
                        ? p.last_season_points
                        : "–"}
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums text-brand-accent">
                      {xpt != null ? xpt.toFixed(1) : "–"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
