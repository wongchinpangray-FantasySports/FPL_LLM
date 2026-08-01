import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";

const COLS =
  "fpl_id,web_name,name,team,team_id,position,penalties_order,direct_freekicks_order,corners_and_indirect_freekicks_order,penalties_text,direct_freekicks_text,corners_and_indirect_freekicks_text";

export type SetPieceRow = {
  fpl_id: number;
  web_name: string;
  team: string;
  team_id: number | null;
  position: string | null;
  penalties_order: number | null;
  direct_freekicks_order: number | null;
  corners_order: number | null;
  penalties_note: string | null;
  freekicks_note: string | null;
  corners_note: string | null;
};

export type SetPieceTeamGroup = {
  team: string;
  team_id: number | null;
  rows: SetPieceRow[];
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function hasSetPieceRole(row: Record<string, unknown>): boolean {
  return (
    num(row.penalties_order) != null ||
    num(row.direct_freekicks_order) != null ||
    num(row.corners_and_indirect_freekicks_order) != null
  );
}

function toRow(row: Record<string, unknown>): SetPieceRow {
  return {
    fpl_id: row.fpl_id as number,
    web_name: (row.web_name as string | null) ?? (row.name as string) ?? `#${row.fpl_id}`,
    team: (row.team as string) ?? "—",
    team_id: (row.team_id as number | null) ?? null,
    position: (row.position as string | null) ?? null,
    penalties_order: num(row.penalties_order),
    direct_freekicks_order: num(row.direct_freekicks_order),
    corners_order: num(row.corners_and_indirect_freekicks_order),
    penalties_note: (row.penalties_text as string | null) ?? null,
    freekicks_note: (row.direct_freekicks_text as string | null) ?? null,
    corners_note: (row.corners_and_indirect_freekicks_text as string | null) ?? null,
  };
}

export async function loadSetPiecesRaw(): Promise<{
  rows: SetPieceRow[];
  teams: SetPieceTeamGroup[];
}> {
  const supa = getServerSupabase();
  const { data, error } = await supa.from("players_static").select(COLS);
  if (error) throw new Error(error.message);

  const rows = (data ?? [])
    .filter(hasSetPieceRole)
    .map((r) => toRow(r as Record<string, unknown>))
    .sort((a, b) => {
      const tc = a.team.localeCompare(b.team);
      if (tc !== 0) return tc;
      const penA = a.penalties_order ?? 99;
      const penB = b.penalties_order ?? 99;
      if (penA !== penB) return penA - penB;
      return a.web_name.localeCompare(b.web_name);
    });

  const byTeam = new Map<string, SetPieceRow[]>();
  for (const row of rows) {
    const list = byTeam.get(row.team) ?? [];
    list.push(row);
    byTeam.set(row.team, list);
  }

  const teams: SetPieceTeamGroup[] = [...byTeam.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([team, teamRows]) => ({
      team,
      team_id: teamRows[0]?.team_id ?? null,
      rows: teamRows,
    }));

  return { rows, teams };
}

export const loadSetPieces = unstable_cache(
  loadSetPiecesRaw,
  ["fpl-insights-set-pieces-v1"],
  { revalidate: 300 },
);
