import { getServerSupabase } from "@/lib/supabase";
import {
  nextFixtureForPlayers,
  projectPlayers,
  type NextFixtureOpponent,
} from "@/lib/xp";
import { resolvePlannerProjectionWindow } from "@/lib/planner/projection-window";

export type SwapRecKind = "xp" | "dc" | "threat";

export type SwapRecommendation = {
  kind: SwapRecKind;
  fpl_id: number;
  web_name: string;
  team: string;
  team_id: number | null;
  position: string;
  base_price: number | null;
  /** Metric shown for this recommendation. */
  metric_label: string;
  metric_value: number;
  next: NextFixtureOpponent | null;
};

type StaticRow = {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
  status: string | null;
  chance_of_playing: number | null;
  minutes: number | null;
  form: number | null;
  threat: number | null;
  total_points: number | null;
  defensive_contribution: number | null;
  defensive_contribution_per_90: number | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isAvailable(status: string | null, chance: number | null): boolean {
  const s = (status ?? "a").toLowerCase();
  if (s === "u" || s === "n" || s === "s") return false;
  if (chance != null && chance < 50) return false;
  return true;
}

function dcPer90(row: StaticRow): number | null {
  const mins = num(row.minutes) ?? 0;
  if (mins <= 0) return null;
  const raw = num(row.defensive_contribution_per_90);
  if (raw != null && raw >= 0) return Math.round(raw * 10) / 10;
  const total = num(row.defensive_contribution);
  if (total == null || total < 0) return null;
  return Math.round((total / mins) * 90 * 10) / 10;
}

function displayName(row: StaticRow): string {
  return row.web_name?.trim() || row.name?.trim() || `#${row.fpl_id}`;
}

/**
 * Three transfer-in ideas for a planner slot: best next-GW xP, highest DC/90,
 * and highest threat — same position, excluding current squad, with next FDR.
 */
export async function loadSwapRecommendations(opts: {
  position: string;
  excludeIds?: number[];
  horizon?: number;
}): Promise<{
  position: string;
  fromGw: number;
  recommendations: SwapRecommendation[];
}> {
  const position = opts.position.toUpperCase();
  if (!["GKP", "DEF", "MID", "FWD"].includes(position)) {
    throw new Error("position must be GKP, DEF, MID, or FWD");
  }
  const exclude = new Set(
    (opts.excludeIds ?? []).filter((n) => Number.isFinite(n) && n > 0),
  );

  const window = await resolvePlannerProjectionWindow(opts.horizon ?? 5);
  const { currentGw, fromGw, toGw } = window;

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("players_static")
    .select(
      "fpl_id,web_name,name,team,team_id,position,base_price,status,chance_of_playing,minutes,form,threat,total_points,defensive_contribution,defensive_contribution_per_90",
    )
    .eq("position", position)
    .not("team_id", "is", null);

  if (error) throw new Error(error.message);

  const pool = ((data ?? []) as StaticRow[]).filter((r) => {
    if (exclude.has(r.fpl_id)) return false;
    return isAvailable(
      r.status,
      typeof r.chance_of_playing === "number" ? r.chance_of_playing : null,
    );
  });

  const picked = new Set<number>();
  const recommendations: SwapRecommendation[] = [];

  // 1) High threat
  const byThreat = [...pool]
    .map((r) => ({ row: r, threat: num(r.threat) ?? 0 }))
    .filter((x) => x.threat > 0)
    .sort((a, b) => b.threat - a.threat);
  const threatPick = byThreat.find((x) => !picked.has(x.row.fpl_id));
  if (threatPick) {
    picked.add(threatPick.row.fpl_id);
    recommendations.push({
      kind: "threat",
      fpl_id: threatPick.row.fpl_id,
      web_name: displayName(threatPick.row),
      team: threatPick.row.team ?? "—",
      team_id: threatPick.row.team_id ?? null,
      position,
      base_price: num(threatPick.row.base_price),
      metric_label: "Threat",
      metric_value: Math.round(threatPick.threat * 10) / 10,
      next: null,
    });
  }

  // 2) High DC/90 (especially useful for DEF; still show for others)
  const byDc = [...pool]
    .map((r) => ({ row: r, dc: dcPer90(r) }))
    .filter((x): x is { row: StaticRow; dc: number } => x.dc != null && x.dc > 0)
    .sort((a, b) => b.dc - a.dc);
  const dcPick = byDc.find((x) => !picked.has(x.row.fpl_id));
  if (dcPick) {
    picked.add(dcPick.row.fpl_id);
    recommendations.push({
      kind: "dc",
      fpl_id: dcPick.row.fpl_id,
      web_name: displayName(dcPick.row),
      team: dcPick.row.team ?? "—",
      team_id: dcPick.row.team_id ?? null,
      position,
      base_price: num(dcPick.row.base_price),
      metric_label: "DC/90",
      metric_value: dcPick.dc,
      next: null,
    });
  }

  // 3) High next-GW xP — project a shortlist (form / points leaders)
  const xpShortlist = [...pool]
    .map((r) => ({
      row: r,
      score:
        (num(r.form) ?? 0) * 10 +
        (num(r.total_points) ?? 0) +
        (num(r.minutes) ?? 0) / 90,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map((x) => x.row.fpl_id);

  if (xpShortlist.length > 0) {
    const proj = await projectPlayers(xpShortlist, {
      currentGw,
      fromGw,
      toGw: Math.min(toGw, fromGw), // next fixture window only for ranking
    });
    const ranked = [...proj.values()]
      .map((p) => {
        const xpNext = p.fixtures
          .filter((f) => f.gw === fromGw)
          .reduce((s, f) => s + f.xp_total, 0);
        return { p, xpNext: Math.round(xpNext * 100) / 100 };
      })
      .filter((x) => !picked.has(x.p.fpl_id))
      .sort((a, b) => b.xpNext - a.xpNext);
    const xpPick = ranked[0];
    if (xpPick) {
      const meta = pool.find((r) => r.fpl_id === xpPick.p.fpl_id);
      recommendations.push({
        kind: "xp",
        fpl_id: xpPick.p.fpl_id,
        web_name: xpPick.p.web_name ?? meta?.web_name ?? `#${xpPick.p.fpl_id}`,
        team: xpPick.p.team ?? meta?.team ?? "—",
        team_id: meta?.team_id ?? null,
        position,
        base_price: num(meta?.base_price) ?? xpPick.p.price ?? null,
        metric_label: `xP GW${fromGw}`,
        metric_value: xpPick.xpNext,
        next: null,
      });
    }
  }

  // Prefer display order: xP, DC, Threat
  const order: SwapRecKind[] = ["xp", "dc", "threat"];
  recommendations.sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );

  const ids = recommendations.map((r) => r.fpl_id);
  const fx = await nextFixtureForPlayers(ids, { minGw: fromGw });
  for (const rec of recommendations) {
    rec.next = fx.get(rec.fpl_id) ?? null;
  }

  return { position, fromGw, recommendations };
}
