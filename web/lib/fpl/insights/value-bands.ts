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

export type ValueBandCategoryPlayer = {
  fpl_id: number;
  web_name: string;
  team: string;
  value: number;
};

export type ValueBandCategoryTop = {
  kind: "xp" | "defcon" | "attack";
  label: string;
  label_zh: string;
  players: ValueBandCategoryPlayer[];
};

export type ValueBandAnalysis = {
  position: ValueBandPosition;
  min_price: number;
  max_price: number;
  horizon: number;
  assessed: number;
  rows: ValueBandRow[];
  takeaways: ValueBandTakeaway[];
  category_tops: ValueBandCategoryTop[];
  generated_at: string;
};

export type ValueBandPreset = {
  id: string;
  position: ValueBandPosition;
  minPrice: number;
  maxPrice: number;
  href: string;
};

/**
 * Band floor prices for Best of Position (budget → mid-premium).
 * Each floor covers a half-open range up to the next floor − £0.1
 * (e.g. DEF £4.5 → £4.5–4.9, so a £4.7 like De Cuyper appears).
 * The top band for each position runs up to LAST_BAND_CEILING.
 */
const BAND_PRICES: Record<ValueBandPosition, number[]> = {
  GKP: [4.0, 4.5, 5.0, 5.5],
  DEF: [4.0, 4.5, 5.0, 5.5, 6.0],
  MID: [4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0],
  FWD: [4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0],
};

/** Inclusive upper bound for the last (highest) band per position. */
const LAST_BAND_CEILING: Record<ValueBandPosition, number> = {
  GKP: 6.0,
  DEF: 7.5,
  MID: 15.0,
  FWD: 15.0,
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

/** Display label for a band, e.g. `4.5` or `4.5–4.9`. */
export function formatValueBandRange(
  minPrice: number,
  maxPrice: number,
): string {
  const lo = formatValueBandPrice(minPrice);
  const hi = formatValueBandPrice(maxPrice);
  if (lo === hi) return lo;
  return `${lo}–${hi}`;
}

export function valueBandSlug(position: ValueBandPosition, price: number): string {
  return `${position.toLowerCase()}-${formatValueBandPrice(price).replace(".", "-")}`;
}

function bandMaxPrice(
  position: ValueBandPosition,
  price: number,
  nextPrice: number | undefined,
): number {
  if (nextPrice != null && Number.isFinite(nextPrice)) {
    // FPL steps are £0.1 — cover everything below the next labelled floor.
    return Math.round((nextPrice - 0.1) * 10) / 10;
  }
  return LAST_BAND_CEILING[position];
}

function buildPreset(
  position: ValueBandPosition,
  price: number,
  nextPrice?: number,
): ValueBandPreset {
  const id = valueBandSlug(position, price);
  return {
    id,
    position,
    minPrice: price,
    maxPrice: bandMaxPrice(position, price, nextPrice),
    href: `${BEST_OF_POSITION_HUB_HREF}/${id}`,
  };
}

export const VALUE_BAND_PRESETS: ValueBandPreset[] =
  VALUE_BAND_POSITION_ORDER.flatMap((position) => {
    const prices = BAND_PRICES[position];
    return prices.map((price, i) =>
      buildPreset(position, price, prices[i + 1]),
    );
  });

export type ValueBandPresetId = (typeof VALUE_BAND_PRESETS)[number]["id"];

/** FPL DC/90 is (season_dc / minutes) * 90 — tiny samples inflate wildly (e.g. 1 DC in 2 mins → 45). */
export const VALUE_BAND_MIN_DEFCON_MINUTES = 90;
/** Don't highlight DEFCON options projected for negligible game time. */
export const VALUE_BAND_MIN_EXPECTED_MINUTES = 30;
/**
 * Prior-season (or YTD) minutes floor for "reliable" BoP highlights.
 * ~13×90' — enough to treat threat / upside as more than a rotation cameo.
 */
export const VALUE_BAND_MIN_PRIOR_MINUTES = 1200;
/** Strong next-fixture minutes projection when prior minutes are thin. */
export const VALUE_BAND_MIN_ASSURED_EXPECTED_MINUTES = 60;

/** Solid minutes already on the clock (last season / YTD). */
export function hasReliablePriorMinutes(row: { minutes: number }): boolean {
  return row.minutes >= VALUE_BAND_MIN_PRIOR_MINUTES;
}

/**
 * Prefer players with a meaningful minutes prior, or a strong next-GW
 * projection when the season sample is still thin (preseason / GW1).
 * Used for soft demotion on xP / DEFCON lists.
 */
export function hasReliablePlayingTime(row: {
  minutes: number;
  expected_minutes_next: number | null;
}): boolean {
  if (hasReliablePriorMinutes(row)) return true;
  return (
    (row.expected_minutes_next ?? 0) >= VALUE_BAND_MIN_ASSURED_EXPECTED_MINUTES
  );
}

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

  // Prefer a minutes-reliable xP leader for public blurbs / posters.
  const topXp = rows.find(hasReliablePriorMinutes) ?? rows[0]!;
  out.push({
    kind: "xp",
    fpl_id: topXp.fpl_id,
    web_name: topXp.web_name,
    team: topXp.team,
    blurb_en: `${topXp.web_name} leads this band on projected xP (${topXp.xp_total.toFixed(1)}) among regulars (prior minutes ≥ ${VALUE_BAND_MIN_PRIOR_MINUTES}).`,
    blurb_zh: `${topXp.web_name} 在出场可靠球员中以投影 xP ${topXp.xp_total.toFixed(1)} 领跑（上季 ≥${VALUE_BAND_MIN_PRIOR_MINUTES} 分钟）。`,
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
        hasReliablePriorMinutes(r) &&
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

/** Top 3 players per metric for BoP posters / cards. */
export function buildCategoryTops(rows: ValueBandRow[]): ValueBandCategoryTop[] {
  if (!rows.length) return [];

  const toPlayer = (
    r: ValueBandRow,
    value: number,
  ): ValueBandCategoryPlayer => ({
    fpl_id: r.fpl_id,
    web_name: r.web_name,
    team: r.team,
    value,
  });

  /**
   * Prefer minutes-reliable players; if fewer than `n`, backfill from the
   * remainder so posters still fill (with lower-confidence names last).
   */
  function pickTop(
    ordered: ValueBandRow[],
    valueOf: (r: ValueBandRow) => number,
    n = 3,
  ): ValueBandCategoryPlayer[] {
    const reliable = ordered.filter(hasReliablePlayingTime);
    const rest = ordered.filter((r) => !hasReliablePlayingTime(r));
    return [...reliable, ...rest].slice(0, n).map((r) => toPlayer(r, valueOf(r)));
  }

  // xP rows are already sorted by xp_total desc — prefer prior-minutes
  // confidence first, then backfill so thin-sample leaders don't vanish.
  const xpPreferred = rows.filter(hasReliablePriorMinutes);
  const xpRest = rows.filter((r) => !hasReliablePriorMinutes(r));
  const xp = [...xpPreferred, ...xpRest]
    .slice(0, 3)
    .map((r) => toPlayer(r, r.xp_total));

  const defconOrdered = [...rows]
    .filter(
      (r) =>
        (r.defensive_contribution_per_90 ?? 0) > 0 &&
        (r.expected_minutes_next ?? 0) >= VALUE_BAND_MIN_EXPECTED_MINUTES,
    )
    .sort(
      (a, b) =>
        (b.defensive_contribution_per_90 ?? 0) -
        (a.defensive_contribution_per_90 ?? 0),
    );
  const defcon = pickTop(defconOrdered, (r) => r.defensive_contribution_per_90 ?? 0);

  // Threat: prefer prior-minutes confidence, then backfill so thin bands
  // still show 3 names on posters (same pattern as DEFCON / xP).
  const attackOrdered = [...rows]
    .filter((r) => (r.threat ?? 0) > 0)
    .sort((a, b) => (b.threat ?? 0) - (a.threat ?? 0));
  const attackPreferred = attackOrdered.filter(hasReliablePriorMinutes);
  const attackRest = attackOrdered.filter((r) => !hasReliablePriorMinutes(r));
  const attack = [...attackPreferred, ...attackRest]
    .slice(0, 3)
    .map((r) => toPlayer(r, r.threat ?? 0));

  const out: ValueBandCategoryTop[] = [];
  if (xp.length) {
    out.push({ kind: "xp", label: "xP", label_zh: "投影 xP", players: xp });
  }
  if (defcon.length) {
    out.push({
      kind: "defcon",
      label: "DEFCON",
      label_zh: "DEFCON/90",
      players: defcon,
    });
  }
  if (attack.length) {
    out.push({
      kind: "attack",
      label: "THREAT",
      label_zh: "威胁指数",
      players: attack,
    });
  }
  return out;
}

export async function loadValueBandAnalysisRaw(opts: {
  position: ValueBandPosition;
  minPrice: number;
  maxPrice: number;
  horizon?: number;
  limit?: number;
}): Promise<ValueBandAnalysis> {
  const horizon = Math.min(Math.max(opts.horizon ?? 5, 1), 8);
  // Show every eligible player in the band (ranges can be wide for MIDs/FWDs).
  const limit = Math.min(Math.max(opts.limit ?? 300, 1), 400);
  const supa = getServerSupabase();
  const officialIds = await loadOfficialFplPlayerIdSet();

  const { data: pool, error } = await supa
    .from("players_static")
    .select(
      "fpl_id,web_name,name,team,team_id,position,base_price,selected_by_percent,status,chance_of_playing,minutes,form,threat,defensive_contribution,defensive_contribution_per_90",
    )
    .eq("position", opts.position)
    .gte("base_price", opts.minPrice)
    .lte("base_price", opts.maxPrice)
    .order("base_price", { ascending: true })
    .limit(500);

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

  // Build from the filtered pool so every in-band player appears, even if
  // projection skips them (missing team, etc.).
  const rows: ValueBandRow[] = filtered
    .map((meta) => {
      const p = projections.get(meta.fpl_id);
      const pre = preById.get(meta.fpl_id);
      const nextMins =
        p && p.fixtures.length > 0
          ? p.fixtures.reduce(
              (s: number, f: { expected_minutes: number }) =>
                s + f.expected_minutes,
              0,
            ) / p.fixtures.length
          : null;
      return {
        fpl_id: meta.fpl_id,
        web_name: p?.web_name ?? meta.web_name,
        team: p?.team ?? meta.team,
        position: p?.position ?? meta.position,
        price: p?.price ?? meta.base_price,
        ownership: p?.ownership ?? meta.selected_by_percent,
        form: p?.form ?? meta.form,
        xp_total: p?.xp_total ?? 0,
        xp_per_game: p?.xp_per_game ?? 0,
        value_per_million: p?.value_per_million ?? null,
        expected_minutes_next:
          nextMins != null ? Math.round(nextMins * 10) / 10 : null,
        threat: meta.threat,
        defensive_contribution: meta.defensive_contribution,
        // Suppress tiny-sample FPL rates (Dasilva: 1 DC / 2 mins → 45.0).
        defensive_contribution_per_90: reliableDefconPer90(
          meta.minutes,
          meta.defensive_contribution_per_90,
        ),
        minutes: meta.minutes,
        preseason_goals: pre?.goals ?? 0,
        preseason_assists: pre?.assists ?? 0,
        preseason_starts: pre?.starts ?? 0,
        fixtures: (p?.fixtures ?? []).map(
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
    category_tops: buildCategoryTops(rows),
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
    limit: 300,
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
    ["fpl-insights-bop-v3", id],
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
