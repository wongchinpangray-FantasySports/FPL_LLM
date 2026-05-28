import type { WcPlayer, WcRadarAxes } from "@/lib/wc/types";

export type WcRadarMetric = keyof WcRadarAxes;

export const WC_RADAR_LABELS: Record<WcRadarMetric, string> = {
  xg: "xG",
  xa: "xA",
  form: "Form",
  goals: "Goals",
  assists: "Assists",
};

export const WC_RADAR_ORDER: WcRadarMetric[] = [
  "xg",
  "xa",
  "form",
  "goals",
  "assists",
];

function maxOf(players: WcPlayer[], pick: (p: WcPlayer) => number): number {
  let m = 0;
  for (const p of players) {
    m = Math.max(m, pick(p));
  }
  return m > 0 ? m : 1;
}

function norm(value: number, max: number): number {
  return Math.round(Math.min(100, Math.max(0, (value / max) * 100)));
}

/** Scale each axis 0–100 vs the full WC player pool. */
export function buildWcRadarAxes(
  player: WcPlayer,
  pool: WcPlayer[],
): WcRadarAxes {
  const maxXg = maxOf(pool, (p) => p.xg);
  const maxXa = maxOf(pool, (p) => p.xa);
  const maxForm = maxOf(pool, (p) => p.form);
  const maxGoals = maxOf(pool, (p) => p.goals);
  const maxAssists = maxOf(pool, (p) => p.assists);

  return {
    xg: norm(player.xg, maxXg),
    xa: norm(player.xa, maxXa),
    form: norm(player.form, maxForm),
    goals: norm(player.goals, maxGoals),
    assists: norm(player.assists, maxAssists),
  };
}

export function radarAxesToArray(axes: WcRadarAxes): number[] {
  return WC_RADAR_ORDER.map((k) => axes[k]);
}

export function radarLabelsArray(): string[] {
  return WC_RADAR_ORDER.map((k) => WC_RADAR_LABELS[k]);
}

export type WcComparePlayer = {
  id: number;
  name: string;
  team_code: string;
  position: string;
  price: number | null;
  selection_pct: number;
  xp_total: number;
  fpl_linked: boolean;
  raw: Pick<WcPlayer, "xg" | "xa" | "form" | "goals" | "assists">;
  values: number[];
};

export type WcComparePayload = {
  a: WcComparePlayer;
  b: WcComparePlayer;
  labels: string[];
};

function toComparePlayer(
  p: WcPlayer,
  pool: WcPlayer[],
  xp_total: number,
): WcComparePlayer {
  return {
    id: p.id,
    name: p.name,
    team_code: p.team_code,
    position: p.position,
    price: p.price,
    selection_pct: p.selection_pct,
    xp_total,
    fpl_linked: p.fpl_id != null,
    raw: {
      xg: p.xg,
      xa: p.xa,
      form: p.form,
      goals: p.goals,
      assists: p.assists,
    },
    values: radarAxesToArray(buildWcRadarAxes(p, pool)),
  };
}

export function buildWcCompare(
  a: WcPlayer,
  b: WcPlayer,
  pool: WcPlayer[],
  xpById: Map<number, number>,
): WcComparePayload {
  return {
    a: toComparePlayer(a, pool, xpById.get(a.id) ?? 0),
    b: toComparePlayer(b, pool, xpById.get(b.id) ?? 0),
    labels: radarLabelsArray(),
  };
}
