import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import {
  loadOfficialFplPlayerIdSet,
  normalizeInsightPlayerRows,
} from "@/lib/fpl/insights/dedupe";
import { loadPreseasonSignals } from "@/lib/fpl/insights/preseason-signals";
import { projectPlayers, resolveCurrentGw } from "@/lib/xp";

export type ValueBandPosition = "GKP" | "DEF" | "MID" | "FWD";

export type ValueBandRow = {
  fpl_id: number;
  web_name: string;
  team: string;
  position: string | null;
  price: number | null;
  ownership: number | null;
  form: number | null;
  xp_total: number;
  xp_per_game: number;
  value_per_million: number | null;
  expected_minutes_next: number | null;
  threat: number | null;
  defensive_contribution: number | null;
  defensive_contribution_per_90: number | null;
  minutes: number;
  preseason_goals: number;
  preseason_assists: number;
  preseason_starts: number;
  fixtures: Array<{ gw: number; opp: string; home: boolean; xp: number }>;
};

export type ValueBandTakeaway = {
  kind: "xp" | "defcon" | "attack" | "preseason";
  fpl_id: number;
  web_name: string;
  team: string;
  blurb_en: string;
  blurb_zh: string;
};

export type ValueBandAnalysis = {
  position: ValueBandPosition;
  min_price: number;
  max_price: number;
  horizon: number;
  assessed: number;
  rows: ValueBandRow[];
  takeaways: ValueBandTakeaway[];
  generated_at: string;
};

export type ValueBandPreset = {
  id: string;
  position: ValueBandPosition;
  minPrice: number;
  maxPrice: number;
  href: string;
};

/** Exact-price bands for the Best of Position series (budget → mid-premium). */
const BAND_PRICES: Record<ValueBandPosition, number[]> = {
  GKP: [4.0, 4.5, 5.0, 5.5],
  DEF: [4.0, 4.5, 5.0, 5.5, 6.0],
  MID: [4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0],
  FWD: [4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0],
};

export const VALUE_BAND_POSITION_ORDER: ValueBandPosition[] = [
  "GKP",
  "DEF",
  "MID",
  "FWD",
];

export const BEST_OF_POSITION_HUB_HREF = "/fpl/insights/best-of-position";

export function formatValueBandPrice(price: number): string {
  return price.toFixed(1);
}

export function valueBandSlug(position: ValueBandPosition, price: number): string {
  return `${position.toLowerCase()}-${formatValueBandPrice(price).replace(".", "-")}`;
}

function buildPreset(
  position: ValueBandPosition,
  price: number,
): ValueBandPreset {
  const id = valueBandSlug(position, price);
  return {
    id,
    position,
    minPrice: price,
    maxPrice: price,
    href: `${BEST_OF_POSITION_HUB_HREF}/${id}`,
  };
}

export const VALUE_BAND_PRESETS: ValueBandPreset[] =
  VALUE_BAND_POSITION_ORDER.flatMap((position) =>
    BAND_PRICES[position].map((price) => buildPreset(position, price)),
  );

export type ValueBandPresetId = (typeof VALUE_BAND_PRESETS)[number]["id"];

/** FPL DC/90 is (season_dc / minutes) * 90 — tiny samples inflate wildly (e.g. 1 DC in 2 mins → 45). */
export const VALUE_BAND_MIN_DEFCON_MINUTES = 90;
/** Don't highlight DEFCON options projected for negligible game time. */
export const VALUE_BAND_MIN_EXPECTED_MINUTES = 30;

export function getValueBandPreset(id: string): ValueBandPreset | null {
  return VALUE_BAND_PRESETS.find((p) => p.id === id) ?? null;
}

export function listValueBandsByPosition(
  position: ValueBandPosition,
): ValueBandPreset[] {
  return VALUE_BAND_PRESETS.filter((p) => p.position === position);
}

export function groupValueBandsByPosition(): Map<
  ValueBandPosition,
  ValueBandPreset[]
> {
  const map = new Map<ValueBandPosition, ValueBandPreset[]>();
  for (const pos of VALUE_BAND_POSITION_ORDER) {
    map.set(pos, listValueBandsByPosition(pos));
  }
  return map;
}

/** FPL-style short position code for chips / titles. */
export function valueBandPositionCode(position: ValueBandPosition): string {
  return position;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Null out FPL DC/90 until enough season minutes make the rate meaningful. */
export function reliableDefconPer90(
  minutes: number,
  raw: number | null | undefined,
  minMinutes = VALUE_BAND_MIN_DEFCON_MINUTES,
): number | null {
  if (minutes < minMinutes) return null;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

function buildTakeaways(rows: ValueBandRow[]): ValueBandTakeaway[] {
  if (!rows.length) return [];
  const out: ValueBandTakeaway[] = [];

  const topXp = rows[0]!;
  out.push({
    kind: "xp",
    fpl_id: topXp.fpl_id,
    web_name: topXp.web_name,
    team: topXp.team,
    blurb_en: `${topXp.web_name} leads this band on projected xP (${topXp.xp_total.toFixed(1)}) over the next fixtures.`,
    blurb_zh: `${topXp.web_name} 在该价位以投影 xP ${topXp.xp_total.toFixed(1)} 领跑。`,
  });

  const defcon = [...rows]
    .filter(
      (r) =>
        (r.defensive_contribution_per_90 ?? 0) > 0 &&
        (r.expected_minutes_next ?? 0) >= VALUE_BAND_MIN_EXPECTED_MINUTES,
    )
    .sort(
      (a, b) =>
        (b.defensive_contribution_per_90 ?? 0) -
        (a.defensive_contribution_per_90 ?? 0),
    )[0];
  if (defcon && defcon.fpl_id !== topXp.fpl_id) {
    out.push({
      kind: "defcon",
      fpl_id: defcon.fpl_id,
      web_name: defcon.web_name,
      team: defcon.team,
      blurb_en: `${defcon.web_name} is the standout DEFCON/90 option at this price (${(defcon.defensive_contribution_per_90 ?? 0).toFixed(1)}).`,
      blurb_zh: `${defcon.web_name} 是该价位 DEFCON/90 最强选项（${(defcon.defensive_contribution_per_90 ?? 0).toFixed(1)}）。`,
    });
  }

  const attack = [...rows]
    .filter(
      (r) =>
        ((r.threat ?? 0) > 0 || r.preseason_goals > 0) &&
        !out.some((t) => t.fpl_id === r.fpl_id),
    )
    .sort(
      (a, b) =>
        b.preseason_goals * 10 +
        (b.threat ?? 0) -
        (a.preseason_goals * 10 + (a.threat ?? 0)),
    )[0];
  if (attack) {
    const ps =
      attack.preseason_goals > 0
        ? `pre-season goals: ${attack.preseason_goals}`
        : `threat ${attack.threat?.toFixed(1) ?? "—"}`;
    const psZh =
      attack.preseason_goals > 0
        ? `季前赛 ${attack.preseason_goals} 球`
        : `威胁指数 ${attack.threat?.toFixed(1) ?? "—"}`;
    out.push({
      kind: attack.preseason_goals > 0 ? "preseason" : "attack",
      fpl_id: attack.fpl_id,
      web_name: attack.web_name,
      team: attack.team,
      blurb_en: `${attack.web_name} offers attacking upside (${ps}).`,
      blurb_zh: `${attack.web_name} 具备进攻上行空间（${psZh}）。`,
    });
  }

  return out.slice(0, 3);
}

export async function loadValueBandAnalysisRaw(opts: {
  position: ValueBandPosition;
  minPrice: number;
  maxPrice: number;
  horizon?: number;
  limit?: number;
}): Promise<ValueBandAnalysis> {
  const horizon = Math.min(Math.max(opts.horizon ?? 5, 1), 8);
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 120);
  const supa = getServerSupabase();
  const officialIds = await loadOfficialFplPlayerIdSet();

  const { data: pool, error } = await supa
    .from("players_static")
    .select(
      "fpl_id,web_name,name,team,team_id,position,base_price,selected_by_percent,status,chance_of_playing,minutes,form,threat,defensive_contribution,defensive_contribution_per_90",
    )
    .eq("position", opts.position)
    .gte("base_price", opts.minPrice)
    .lte("base_price", opts.maxPrice);

  if (error) throw new Error(error.message);

  const filtered = normalizeInsightPlayerRows(
    (pool ?? [])
      .filter((r) => {
        const s = (r.status as string | null) ?? "a";
        if (s === "u" || s === "n" || s === "s") return false;
        const cop = r.chance_of_playing;
        if (typeof cop === "number" && cop < 50) return false;
        return true;
      })
      .map((r) => ({
        fpl_id: r.fpl_id as number,
        web_name:
          (r.web_name as string | null) ??
          (r.name as string) ??
          `#${r.fpl_id}`,
        team_id: (r.team_id as number | null) ?? null,
        team: (r.team as string) ?? "—",
        position: (r.position as string | null) ?? null,
        base_price: num(r.base_price),
        selected_by_percent: num(r.selected_by_percent),
        minutes: num(r.minutes) ?? 0,
        form: num(r.form),
        threat: num(r.threat),
        defensive_contribution: num(r.defensive_contribution),
        defensive_contribution_per_90: num(r.defensive_contribution_per_90),
      })),
    officialIds,
  );

  const byId = new Map(filtered.map((r) => [r.fpl_id, r]));
  const ids = filtered.map((r) => r.fpl_id);

  const [{ current, next }, preseason] = await Promise.all([
    resolveCurrentGw(),
    loadPreseasonSignals().catch(() => ({ rows: [] as Awaited<
      ReturnType<typeof loadPreseasonSignals>
    >["rows"] })),
  ]);

  const preById = new Map<
    number,
    { goals: number; assists: number; starts: number }
  >();
  for (const row of preseason.rows) {
    if (row.fpl_id == null) continue;
    preById.set(row.fpl_id, {
      goals: row.goals,
      assists: row.assists,
      starts: row.starts,
    });
  }

  const projections =
    ids.length > 0
      ? await projectPlayers(ids, {
          currentGw: current,
          fromGw: next,
          toGw: next + horizon - 1,
        })
      : await projectPlayers([], {
          currentGw: current,
          fromGw: next,
          toGw: next + horizon - 1,
        });

  const rows: ValueBandRow[] = Array.from(projections.values())
    .map((p) => {
      const meta = byId.get(p.fpl_id);
      const pre = preById.get(p.fpl_id);
      const nextMins =
        p.fixtures.length > 0
          ? p.fixtures.reduce(
              (s: number, f: { expected_minutes: number }) =>
                s + f.expected_minutes,
              0,
            ) / p.fixtures.length
          : null;
      return {
        fpl_id: p.fpl_id,
        web_name: p.web_name ?? meta?.web_name ?? `#${p.fpl_id}`,
        team: p.team ?? meta?.team ?? "—",
        position: p.position ?? meta?.position ?? null,
        price: p.price ?? meta?.base_price ?? null,
        ownership: p.ownership ?? meta?.selected_by_percent ?? null,
        form: p.form ?? meta?.form ?? null,
        xp_total: p.xp_total,
        xp_per_game: p.xp_per_game,
        value_per_million: p.value_per_million,
        expected_minutes_next:
          nextMins != null ? Math.round(nextMins * 10) / 10 : null,
        threat: meta?.threat ?? null,
        defensive_contribution: meta?.defensive_contribution ?? null,
        // Suppress tiny-sample FPL rates (Dasilva: 1 DC / 2 mins → 45.0).
        defensive_contribution_per_90: reliableDefconPer90(
          meta?.minutes ?? 0,
          meta?.defensive_contribution_per_90,
        ),
        minutes: meta?.minutes ?? 0,
        preseason_goals: pre?.goals ?? 0,
        preseason_assists: pre?.assists ?? 0,
        preseason_starts: pre?.starts ?? 0,
        fixtures: p.fixtures.map(
          (f: {
            gw: number;
            opp_short: string;
            home: boolean;
            xp_total: number;
          }) => ({
            gw: f.gw,
            opp: f.opp_short,
            home: f.home,
            xp: f.xp_total,
          }),
        ),
      };
    })
    .sort((a, b) => b.xp_total - a.xp_total)
    .slice(0, limit);

  return {
    position: opts.position,
    min_price: opts.minPrice,
    max_price: opts.maxPrice,
    horizon,
    assessed: filtered.length,
    rows,
    takeaways: buildTakeaways(rows),
    generated_at: new Date().toISOString(),
  };
}

export async function loadValueBandByPreset(
  preset: ValueBandPreset,
): Promise<ValueBandAnalysis> {
  return loadValueBandAnalysisRaw({
    position: preset.position,
    minPrice: preset.minPrice,
    maxPrice: preset.maxPrice,
    horizon: 5,
    limit: 100,
  });
}

/** Per-band cached loader (key includes preset id). */
export async function loadValueBandByPresetCached(
  id: string,
): Promise<ValueBandAnalysis | null> {
  const preset = getValueBandPreset(id);
  if (!preset) return null;
  return unstable_cache(
    async () => loadValueBandByPreset(preset),
    ["fpl-insights-bop-v2", id],
    { revalidate: 300 },
  )();
}

/** @deprecated Use loadValueBandByPreset / mid-5-0 preset — kept for notify script. */
export async function loadMid50ValueBand(): Promise<ValueBandAnalysis> {
  const preset = getValueBandPreset("mid-5-0");
  if (!preset) throw new Error("mid-5-0 preset missing");
  return loadValueBandByPreset(preset);
}

export const loadMid50ValueBandCached = unstable_cache(
  async () => loadMid50ValueBand(),
  ["fpl-insights-value-mid-5-0-v2"],
  { revalidate: 300 },
);
