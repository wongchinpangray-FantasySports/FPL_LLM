"use client";

import { useCallback, useEffect, useState } from "react";
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
  selected_by_percent: number | null;
  form: number | null;
};

type TeamOption = { id: number; short_name: string; name: string };

type SortKey = "price" | "points" | "ownership" | "form";

export function SquadBuilderPlayerPanel({
  selectedSlot,
  slotPosition,
  bank,
  projById,
  squadFplIds,
  teams,
  onPickPlayer,
  labels,
}: {
  selectedSlot: number | null;
  slotPosition: string | null;
  bank: number;
  projById: Record<string, { xp_next_gw?: number }>;
  squadFplIds: Set<number>;
  teams: TeamOption[];
  onPickPlayer: (player: BrowsePlayer) => void;
  labels: {
    title: string;
    slotHint: string;
    search: string;
    positionAll: string;
    clubAll: string;
    sortPrice: string;
    sortPoints: string;
    sortOwnership: string;
    sortForm: string;
    colName: string;
    colOwn: string;
    colPrice: string;
    colXpts: string;
    inSquad: string;
    loading: string;
    empty: string;
  };
}) {
  const [position, setPosition] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("price");
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState<BrowsePlayer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (slotPosition) setPosition(slotPosition);
  }, [slotPosition, selectedSlot]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort,
        limit: "60",
        max_price: String(Math.max(bank, 0.1)),
      });
      if (q.trim()) params.set("q", q.trim());
      if (position) params.set("position", position);
      if (teamId) params.set("team_id", teamId);
      const res = await fetch(`/api/squad-builder/players?${params}`);
      const data = (await res.json()) as { players?: BrowsePlayer[] };
      setPlayers(data.players ?? []);
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [q, position, teamId, sort, bank]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <aside className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-6rem)]">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {labels.slotHint.replace(
            "{slot}",
            selectedSlot != null ? String(selectedSlot) : "–",
          )}
        </p>
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
          {teams.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.short_name}
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
      </select>

      <div className="min-h-[280px] flex-1 overflow-y-auto rounded-lg border border-border/60 lg:min-h-0">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
              <th className="px-2 py-2 text-left">{labels.colName}</th>
              <th className="px-1 py-2 text-right">{labels.colOwn}</th>
              <th className="px-1 py-2 text-right">{labels.colPrice}</th>
              <th className="px-1 py-2 text-right">{labels.colXpts}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-2 py-8 text-center text-muted-foreground">
                  {labels.loading}
                </td>
              </tr>
            ) : players.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-8 text-center text-muted-foreground">
                  {labels.empty}
                </td>
              </tr>
            ) : (
              players.map((p) => {
                const inSquad = squadFplIds.has(p.fpl_id);
                const xpt = projById[String(p.fpl_id)]?.xp_next_gw;
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
