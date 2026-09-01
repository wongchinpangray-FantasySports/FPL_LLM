import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import {
  loadOfficialFplPlayerIdSet,
  normalizeInsightPlayerRows,
} from "@/lib/fpl/insights/dedupe";
import { withIsolateCache } from "@/lib/worker-isolate-cache";

const COLS =
  "fpl_id,web_name,name,team,team_id,position,minutes,expected_goals,expected_assists,penalties_order,direct_freekicks_order,corners_and_indirect_freekicks_order";

export type SetPieceRow = {
  fpl_id: number;
  web_name: string;
  team: string;
  team_id: number | null;
  position: string | null;
  minutes: number;
  xg_per_90: number | null;
  xa_per_90: number | null;
  penalties_order: number | null;
  direct_freekicks_order: number | null;
  corners_order: number | null;
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

function per90(total: number, minutes: number): number | null {
  if (minutes <= 0 || !Number.isFinite(total)) return null;
  return Math.round(((total * 90) / minutes) * 1000) / 1000;
}

function toRow(row: Record<string, unknown>): SetPieceRow {
  const minutes = num(row.minutes) ?? 0;
  const xg = num(row.expected_goals) ?? 0;
  const xa = num(row.expected_assists) ?? 0;
  return {
    fpl_id: row.fpl_id as number,
    web_name: (row.web_name as string | null) ?? (row.name as string) ?? `#${row.fpl_id}`,
    team: (row.team as string) ?? "—",
    team_id: (row.team_id as number | null) ?? null,
    position: (row.position as string | null) ?? null,
    minutes,
    xg_per_90: per90(xg, minutes),
    xa_per_90: per90(xa, minutes),
    penalties_order: num(row.penalties_order),
    direct_freekicks_order: num(row.direct_freekicks_order),
    corners_order: num(row.corners_and_indirect_freekicks_order),
  };
}

function pickBestOrder(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

function mergeSetPieceRows(a: SetPieceRow, b: SetPieceRow): SetPieceRow {
  const base = a.fpl_id > b.fpl_id ? a : b;
  const minutes = Math.max(a.minutes, b.minutes);
  const pickRate = (
    aRate: number | null,
    bRate: number | null,
    aMins: number,
    bMins: number,
  ): number | null => {
    if (aMins >= bMins) return aRate ?? bRate;
    return bRate ?? aRate;
  };
  return {
    ...base,
    minutes,
    xg_per_90: pickRate(a.xg_per_90, b.xg_per_90, a.minutes, b.minutes),
    xa_per_90: pickRate(a.xa_per_90, b.xa_per_90, a.minutes, b.minutes),
    penalties_order: pickBestOrder(a.penalties_order, b.penalties_order),
    direct_freekicks_order: pickBestOrder(
      a.direct_freekicks_order,
      b.direct_freekicks_order,
    ),
    corners_order: pickBestOrder(a.corners_order, b.corners_order),
  };
}

export type SetPieceRoleLabels = {
  primary: string;
  backup: string;
  ordinal: (order: number) => string;
};

export function formatSetPieceRole(
  order: number | null,
  showDeep: boolean,
  labels: SetPieceRoleLabels,
): string {
  if (order == null) return "—";
  if (order === 1) return labels.primary;
  if (order === 2) return labels.backup;
  if (!showDeep) return "—";
  return labels.ordinal(order);
}

export function formatSetPieceOrdinal(order: number, locale: string): string {
  if (locale.startsWith("zh")) return `第${order}`;
  const mod100 = order % 100;
  const mod10 = order % 10;
  if (mod100 >= 11 && mod100 <= 13) return `${order}th`;
  if (mod10 === 1) return `${order}st`;
  if (mod10 === 2) return `${order}nd`;
  if (mod10 === 3) return `${order}rd`;
  return `${order}th`;
}

export function hasPrimaryOrBackupRole(row: SetPieceRow): boolean {
  return (
    row.penalties_order === 1 ||
    row.penalties_order === 2 ||
    row.direct_freekicks_order === 1 ||
    row.direct_freekicks_order === 2 ||
    row.corners_order === 1 ||
    row.corners_order === 2
  );
}

export async function loadSetPiecesRaw(): Promise<{
  rows: SetPieceRow[];
  teams: SetPieceTeamGroup[];
}> {
  return withIsolateCache("insights-set-pieces", 120_000, () =>
    loadSetPiecesRawUncached(),
  );
}

async function loadSetPiecesRawUncached(): Promise<{
  rows: SetPieceRow[];
  teams: SetPieceTeamGroup[];
}> {
  const [supa, officialIds] = await Promise.all([
    Promise.resolve(getServerSupabase()),
    loadOfficialFplPlayerIdSet(),
  ]);
  const { data, error } = await supa.from("players_static").select(COLS);
  if (error) throw new Error(error.message);

  const rows = normalizeInsightPlayerRows(
    (data ?? [])
      .filter(hasSetPieceRole)
      .map((r) => toRow(r as Record<string, unknown>)),
    officialIds,
    mergeSetPieceRows,
  ).sort((a, b) => {
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
  ["fpl-insights-set-pieces-v6"],
  { revalidate: 300 },
);
