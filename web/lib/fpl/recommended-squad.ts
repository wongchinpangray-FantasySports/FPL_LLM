/**
 * Preseason recommended squad — chip constraints → one shot × 3 contrastive options.
 */
import { chunkArray } from "@/lib/chunk";
import { getServerSupabase } from "@/lib/supabase";
import { findBestXiByXp } from "@/lib/planner/optimize-xi";
import type { PlannerPickPayload } from "@/components/planner/types";
import {
  createEmptySquad,
  SQUAD_BUILDER_BUDGET_M,
} from "@/lib/squad-builder/slots";
import { SQUAD_BUILDER_FROM_GW } from "@/lib/squad-builder/projection-window";
import {
  nextFixtureForPlayers,
  projectPlayers,
  type PlayerProjection,
} from "@/lib/xp";
import { buildBudgetSquad } from "@/lib/fpl/daily-gw1-draft";

const NEED = { GKP: 2, DEF: 5, MID: 5, FWD: 3 } as const;
const POSITIONS = ["GKP", "DEF", "MID", "FWD"] as const;
const LEAGUE_CHUNK = 80;
const DEFAULT_DIFF_MAX_OWN = 10;
const DEFAULT_MIN_DIFFS = 6;
/** Max shared players across any two options in a pack (excl. must-includes). */
const MAX_OPTION_OVERLAP = 8;
/** How many unlocked picks from prior options to hard-ban by default. */
const BASE_BAN_COUNT = 9;

export type SquadStyle =
  | "template"
  | "balanced"
  | "differential"
  | "premium"
  | "budget";

export type SquadGoal = "gw1_5" | "set_and_forget" | "rank_chase";

export type SquadOptionKind = "safe" | "balanced" | "spicy";

export type RecommendedSquadConstraints = {
  style: SquadStyle;
  goal?: SquadGoal;
  excludeIds?: number[];
  includeIds?: number[];
  /** Players under this ownership % count as differentials. */
  differentialMaxOwn?: number;
  /** Hint for differential style (default 6). Soft target, not a hard fail. */
  minDifferentials?: number;
  horizon?: number;
  /**
   * Changes the pick seed so regenerating with the same chips yields a new pack.
   * Clients should pass Date.now() (or similar) on each Generate click.
   */
  diversitySalt?: number;
};

export type RecommendedSquadPlayer = {
  fpl_id: number;
  web_name: string;
  team: string;
  team_id: number;
  team_code: number | null;
  team_short: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  price: number;
  ownership: number;
  xp_gw1: number;
  xp_horizon: number;
  fixture: string | null;
  is_starter: boolean;
  is_captain: boolean;
  is_vice: boolean;
  shirt_url: string;
};

export type RecommendedSquadOption = {
  kind: SquadOptionKind;
  label_en: string;
  label_zh: string;
  formation: string;
  spend_m: number;
  bank_m: number;
  xi_xp: number;
  avg_ownership: number;
  diff_count: number;
  players: RecommendedSquadPlayer[];
  starters: RecommendedSquadPlayer[];
  bench: RecommendedSquadPlayer[];
  captain: RecommendedSquadPlayer;
  vice: RecommendedSquadPlayer;
  why_en: string[];
  why_zh: string[];
  builder_path: string;
  pick_ids: number[];
};

export type RecommendedSquadPack = {
  gw: number;
  horizon: number;
  constraints: RecommendedSquadConstraints;
  differential_max_own: number;
  options: RecommendedSquadOption[];
};

export type ExcludeChipPlayer = {
  fpl_id: number;
  web_name: string;
  team_short: string;
  position: string;
  price: number;
  ownership: number;
};

type Cand = {
  fpl_id: number;
  web_name: string;
  team: string;
  team_id: number;
  team_code: number | null;
  team_short: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  price: number;
  ownership: number;
  xp_gw1: number;
  xp_horizon: number;
  status: string | null;
};

const OPTION_META: Record<
  SquadOptionKind,
  { label_en: string; label_zh: string; seedSalt: number }
> = {
  safe: {
    label_en: "Safest",
    label_zh: "最稳",
    seedSalt: 11,
  },
  balanced: {
    label_en: "Balanced",
    label_zh: "均衡",
    seedSalt: 29,
  },
  spicy: {
    label_en: "Spiciest",
    label_zh: "最差分",
    seedSalt: 47,
  },
};

function shirtUrl(teamCode: number | null, position: string): string {
  if (teamCode == null) {
    return "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-66.webp";
  }
  const gk = position === "GKP" ? "_1" : "";
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}${gk}-66.webp`;
}

function fixtureLabel(
  fx: { opp_short: string; home: boolean } | null | undefined,
): string | null {
  if (!fx) return null;
  return `${fx.opp_short} (${fx.home ? "H" : "A"})`;
}

function formationOf(starters: RecommendedSquadPlayer[]): string {
  const d = starters.filter((p) => p.position === "DEF").length;
  const m = starters.filter((p) => p.position === "MID").length;
  const f = starters.filter((p) => p.position === "FWD").length;
  return `${d}-${m}-${f}`;
}

function hashSeed(parts: string[]): number {
  let h = 0;
  const s = parts.join(":");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h || 1;
}

function toBudgetCand(c: Cand) {
  return {
    fpl_id: c.fpl_id,
    web_name: c.web_name,
    team: c.team,
    team_id: c.team_id,
    team_code: c.team_code,
    team_short: c.team_short,
    position: c.position,
    price: c.price,
    xp_gw1: c.xp_gw1,
    xp_horizon: c.xp_horizon,
    status: c.status,
  };
}

function toPlannerPicks(squad: Cand[]): PlannerPickPayload[] {
  const empty = createEmptySquad();
  const byPos: Record<string, Cand[]> = { GKP: [], DEF: [], MID: [], FWD: [] };
  for (const c of squad) byPos[c.position].push(c);
  for (const pos of POSITIONS) {
    byPos[pos].sort((a, b) => b.xp_gw1 - a.xp_gw1 || a.price - b.price);
  }

  return empty.map((slot) => {
    const pos = slot.position ?? "MID";
    const c = byPos[pos].shift();
    if (!c) return slot;
    return {
      ...slot,
      fpl_id: c.fpl_id,
      web_name: c.web_name,
      team: c.team,
      team_id: c.team_id,
      position: c.position,
      base_price: c.price,
      is_starter: false,
      is_captain: false,
      is_vice_captain: false,
    };
  });
}

export function squadBuilderHref(opts: {
  ids: number[];
  captainId: number;
  viceId: number;
  draft?: number;
}): string {
  const ids = opts.ids.join(",");
  const draft = opts.draft ?? 1;
  return `/squad-builder?ids=${ids}&c=${opts.captainId}&v=${opts.viceId}&draft=${draft}`;
}

export async function loadRecommendedPool(opts: {
  fromGw: number;
  horizon: number;
}): Promise<Cand[]> {
  const { fromGw, horizon } = opts;
  const toGw = fromGw + horizon - 1;
  const supa = getServerSupabase();
  const [{ data: players, error }, { data: teams }] = await Promise.all([
    supa
      .from("players_static")
      .select(
        "fpl_id,web_name,name,team,team_id,position,base_price,status,chance_of_playing,selected_by_percent",
      )
      .not("team_id", "is", null)
      .in("position", [...POSITIONS]),
    supa.from("teams").select("id,short_name,code,name"),
  ]);
  if (error) throw new Error(error.message);

  const teamById = new Map(
    (teams ?? []).map((t) => [
      t.id as number,
      {
        short: (t.short_name as string) ?? "?",
        code: (t.code as number | null) ?? null,
        name: (t.name as string) ?? "",
      },
    ]),
  );

  const ids = (players ?? [])
    .map((r) => r.fpl_id as number)
    .filter((n) => Number.isFinite(n) && n > 0);

  const projById = new Map<number, PlayerProjection>();
  for (const chunk of chunkArray(ids, LEAGUE_CHUNK)) {
    const partial = await projectPlayers(chunk, {
      currentGw: Math.max(1, fromGw - 1),
      fromGw,
      toGw,
    });
    for (const [id, p] of partial) projById.set(id, p);
  }

  const out: Cand[] = [];
  for (const row of players ?? []) {
    const fpl_id = row.fpl_id as number;
    const position = row.position as Cand["position"];
    if (!POSITIONS.includes(position)) continue;
    const status = (row.status as string | null) ?? null;
    if (status === "u" || status === "n") continue;
    const chance = row.chance_of_playing as number | null;
    if (chance != null && chance <= 25) continue;

    const team_id = row.team_id as number;
    const meta = teamById.get(team_id);
    const proj = projById.get(fpl_id);
    const price = Number(row.base_price);
    if (!Number.isFinite(price) || price <= 0) continue;

    const xp_gw1 =
      proj?.fixtures
        .filter((f) => f.gw === fromGw)
        .reduce((s, f) => s + f.xp_total, 0) ?? 0;
    const xp_horizon = proj?.xp_total ?? 0;
    const ownership = Number(row.selected_by_percent) || 0;

    out.push({
      fpl_id,
      web_name:
        (row.web_name as string | null) ??
        (row.name as string | null) ??
        `#${fpl_id}`,
      team: meta?.name || (row.team as string) || "?",
      team_id,
      team_code: meta?.code ?? null,
      team_short: meta?.short ?? "?",
      position,
      price: Math.round(price * 10) / 10,
      ownership: Math.round(ownership * 10) / 10,
      xp_gw1: Math.round(xp_gw1 * 100) / 100,
      xp_horizon: Math.round(xp_horizon * 100) / 100,
      status,
    });
  }
  return out;
}

export async function loadExcludeChipPlayers(
  limit = 12,
): Promise<ExcludeChipPlayer[]> {
  const pool = await loadRecommendedPool({
    fromGw: SQUAD_BUILDER_FROM_GW,
    horizon: 5,
  });
  return [...pool]
    .sort((a, b) => b.ownership - a.ownership || b.price - a.price)
    .slice(0, limit)
    .map((c) => ({
      fpl_id: c.fpl_id,
      web_name: c.web_name,
      team_short: c.team_short,
      position: c.position,
      price: c.price,
      ownership: c.ownership,
    }));
}

/** Take a kind-specific slice so safe/balanced/spicy soft-prefers stay disjoint. */
function sliceByKind<T>(arr: T[], kind: SquadOptionKind, n: number): T[] {
  if (arr.length <= n) return [...arr];
  if (kind === "safe") return arr.slice(0, n);
  if (kind === "spicy") return arr.slice(Math.max(0, arr.length - n));
  const start = Math.max(0, Math.floor((arr.length - n) / 2));
  return arr.slice(start, start + n);
}

function applyStylePool(
  pool: Cand[],
  style: SquadStyle,
  kind: SquadOptionKind,
  diffMax: number,
  avoidPreferIds?: Set<number>,
  diversitySalt = 0,
): {
  pool: Cand[];
  softPreferIds: number[];
  preferValue: boolean;
} {
  let preferValue = style === "budget" || style === "differential";
  if (kind === "spicy") preferValue = true;
  if (kind === "safe") preferValue = false;

  const avoid = avoidPreferIds ?? new Set<number>();
  const scored = [...pool];
  const eligible = (c: Cand) => !avoid.has(c.fpl_id);

  /** Widen the candidate band, then salt-pick so regenerations diverge. */
  const saltPick = (ranked: Cand[], n: number) => {
    const band = sliceByKind(ranked, kind, Math.min(ranked.length, Math.max(n * 3, n)));
    if (band.length <= n) return band.map((c) => c.fpl_id);
    return [...band]
      .sort((a, b) => {
        const ja = ((a.fpl_id * 31 + diversitySalt * 17 + OPTION_META[kind].seedSalt) % 10007);
        const jb = ((b.fpl_id * 31 + diversitySalt * 17 + OPTION_META[kind].seedSalt) % 10007);
        return jb - ja || b.xp_gw1 - a.xp_gw1;
      })
      .slice(0, n)
      .map((c) => c.fpl_id);
  };

  if (style === "premium") {
    const premiums = [...scored]
      .filter((c) => eligible(c) && c.position !== "GKP" && c.price >= 7.5)
      .sort((a, b) => b.price - a.price || b.xp_gw1 - a.xp_gw1);
    return {
      pool: scored,
      softPreferIds: saltPick(premiums, kind === "spicy" ? 6 : 8),
      preferValue,
    };
  }

  if (style === "differential") {
    const diffs = [...scored]
      .filter((c) => eligible(c) && c.ownership <= diffMax && c.xp_gw1 > 0)
      .sort(
        (a, b) =>
          b.xp_gw1 / Math.max(b.ownership, 0.5) -
            a.xp_gw1 / Math.max(a.ownership, 0.5) || b.xp_gw1 - a.xp_gw1,
      );
    return {
      pool: scored,
      softPreferIds: saltPick(diffs, 12),
      preferValue: true,
    };
  }

  if (style === "budget") {
    const enablers = [...scored]
      .filter((c) => eligible(c) && c.price <= 6.5)
      .sort(
        (a, b) =>
          b.xp_gw1 / Math.max(b.price, 4) - a.xp_gw1 / Math.max(a.price, 4),
      );
    return {
      pool: scored,
      softPreferIds: saltPick(enablers, 10),
      preferValue: true,
    };
  }

  if (style === "template") {
    const template = [...scored]
      .filter((c) => eligible(c) && c.ownership >= 12)
      .sort((a, b) => b.ownership - a.ownership || b.xp_gw1 - a.xp_gw1);
    return {
      pool: scored,
      softPreferIds: saltPick(template, 10),
      preferValue,
    };
  }

  if (kind === "spicy") {
    const diffs = [...scored]
      .filter((c) => eligible(c) && c.ownership <= diffMax + 5 && c.xp_gw1 > 0)
      .sort(
        (a, b) =>
          b.xp_gw1 / Math.max(b.ownership, 0.5) -
            a.xp_gw1 / Math.max(a.ownership, 0.5) || b.xp_gw1 - a.xp_gw1,
      );
    return {
      pool: scored,
      softPreferIds: saltPick(diffs, 12),
      preferValue: true,
    };
  }

  if (kind === "safe") {
    const highOwn = [...scored]
      .filter((c) => eligible(c))
      .sort((a, b) => b.ownership - a.ownership || b.xp_gw1 - a.xp_gw1);
    return {
      pool: scored,
      softPreferIds: saltPick(highOwn, 10),
      preferValue: false,
    };
  }

  const mid = [...scored]
    .filter((c) => eligible(c) && c.ownership >= 5 && c.ownership <= 40)
    .sort(
      (a, b) =>
        b.xp_gw1 / Math.max(b.price, 4) - a.xp_gw1 / Math.max(a.price, 4) ||
        b.xp_gw1 - a.xp_gw1,
    );
  const fallback = [...scored]
    .filter((c) => eligible(c))
    .sort((a, b) => b.xp_gw1 - a.xp_gw1);
  return {
    pool: scored,
    softPreferIds: saltPick(mid.length >= 8 ? mid : fallback, 10),
    preferValue: true,
  };
}

/** Prefer banning expensive / high-xP unlocked names so cores diverge. */
function pickBanIds(
  priorSquads: Cand[][],
  lockedIds: Set<number>,
  count: number,
  kind: SquadOptionKind,
): Set<number> {
  const score = (c: Cand) => {
    if (kind === "spicy") {
      return c.ownership * 2 + c.price + c.xp_gw1 * 0.3;
    }
    if (kind === "safe") {
      return 30 - Math.min(c.ownership, 30) + (10 - Math.min(c.price, 10));
    }
    return c.price + c.xp_gw1 * 0.5;
  };

  const seen = new Map<number, Cand>();
  for (const squad of priorSquads) {
    for (const c of squad) {
      if (lockedIds.has(c.fpl_id)) continue;
      if (!seen.has(c.fpl_id)) seen.set(c.fpl_id, c);
    }
  }

  return new Set(
    [...seen.values()]
      .sort((a, b) => score(b) - score(a))
      .slice(0, Math.max(0, count))
      .map((c) => c.fpl_id),
  );
}

function squadOverlap(a: Cand[], b: Cand[], lockedIds: Set<number>): number {
  const setB = new Set(b.map((c) => c.fpl_id));
  return a.filter((c) => setB.has(c.fpl_id) && !lockedIds.has(c.fpl_id)).length;
}

function buildWhy(
  kind: SquadOptionKind,
  constraints: RecommendedSquadConstraints,
  option: {
    formation: string;
    spend_m: number;
    bank_m: number;
    diff_count: number;
    avg_ownership: number;
    captain: RecommendedSquadPlayer;
    excludedNames: string[];
    includedNames: string[];
  },
  diffMax: number,
): { en: string[]; zh: string[] } {
  const style = constraints.style;
  const en: string[] = [];
  const zh: string[] = [];

  if (kind === "safe") {
    en.push("Highest-ownership lean within your constraints.");
    zh.push("在你的限制内，更偏向高拥有率稳阵。");
  } else if (kind === "spicy") {
    en.push("Most differential lean — lower ownership, more upside.");
    zh.push("最差分取向 — 更低拥有、更高上行空间。");
  } else {
    en.push("Best balance of xP, value, and your style options.");
    zh.push("在 xP、性价比与你的风格选项之间取均衡。");
  }

  if (style === "premium") {
    en.push("Premium-heavy: budget stacked into expensive names.");
    zh.push("贵价堆叠：预算集中砸在高价球星。");
  } else if (style === "differential") {
    en.push(
      `Differential target: ${option.diff_count} players under ${diffMax}% owned.`,
    );
    zh.push(`差分目标：${option.diff_count} 人拥有率低于 ${diffMax}%。`);
  } else if (style === "budget") {
    en.push("Budget/enabler lean to leave room for later upgrades.");
    zh.push("廉价支点取向，给后续升级留空间。");
  } else if (style === "template") {
    en.push("Template-friendly core for a safer GW start.");
    zh.push("模板友好核心，开局更稳。");
  }

  if (option.excludedNames.length) {
    en.push(`Excluded: ${option.excludedNames.slice(0, 4).join(", ")}.`);
    zh.push(`已排除：${option.excludedNames.slice(0, 4).join("、")}。`);
  }
  if (option.includedNames.length) {
    en.push(`Locked in: ${option.includedNames.join(", ")}.`);
    zh.push(`必选：${option.includedNames.join("、")}。`);
  }

  en.push(
    `${option.formation} · £${option.spend_m.toFixed(1)}m · ITB £${option.bank_m.toFixed(1)}m · C ${option.captain.web_name}.`,
  );
  zh.push(
    `${option.formation} · £${option.spend_m.toFixed(1)}m · 余额 £${option.bank_m.toFixed(1)}m · 队长 ${option.captain.web_name}。`,
  );

  return { en, zh };
}

function assembleOption(
  squadCands: Cand[],
  opts: {
    kind: SquadOptionKind;
    gw: number;
    horizon: number;
    constraints: RecommendedSquadConstraints;
    diffMax: number;
    excludedNames: string[];
    includedNames: string[];
    fxMap: Map<number, { opp_short: string; home: boolean } | null>;
  },
): RecommendedSquadOption {
  const picks = toPlannerPicks(squadCands);
  const xpByFid: Record<string, number> = {};
  for (const c of squadCands) {
    // Goal: set-and-forget / rank chase weight horizon a bit more for XI.
    const weight =
      opts.constraints.goal === "set_and_forget"
        ? c.xp_horizon * 0.15 + c.xp_gw1
        : opts.constraints.goal === "rank_chase"
          ? c.xp_gw1 * 1.05
          : c.xp_gw1;
    xpByFid[String(c.fpl_id)] = weight;
  }

  const xiIds = findBestXiByXp(picks, xpByFid);
  if (!xiIds || xiIds.length !== 11) {
    throw new Error(`Could not optimise XI for ${opts.kind}.`);
  }
  const xiSet = new Set(xiIds);
  const byId = new Map(squadCands.map((c) => [c.fpl_id, c]));

  const rankedXi = [...xiIds]
    .map((id) => byId.get(id)!)
    .sort((a, b) => b.xp_gw1 - a.xp_gw1);
  const captainId = rankedXi[0]!.fpl_id;
  const viceId = rankedXi[1]?.fpl_id ?? captainId;

  const players: RecommendedSquadPlayer[] = squadCands
    .map((c) => {
      const fx = opts.fxMap.get(c.fpl_id);
      return {
        fpl_id: c.fpl_id,
        web_name: c.web_name,
        team: c.team,
        team_id: c.team_id,
        team_code: c.team_code,
        team_short: c.team_short,
        position: c.position,
        price: c.price,
        ownership: c.ownership,
        xp_gw1: c.xp_gw1,
        xp_horizon: c.xp_horizon,
        fixture: fixtureLabel(fx),
        is_starter: xiSet.has(c.fpl_id),
        is_captain: c.fpl_id === captainId,
        is_vice: c.fpl_id === viceId && c.fpl_id !== captainId,
        shirt_url: shirtUrl(c.team_code, c.position),
      };
    })
    .sort((a, b) => {
      if (a.is_starter !== b.is_starter) return a.is_starter ? -1 : 1;
      const order = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };
      if (order[a.position] !== order[b.position]) {
        return order[a.position] - order[b.position];
      }
      return b.xp_gw1 - a.xp_gw1;
    });

  const starters = players.filter((p) => p.is_starter);
  const bench = players
    .filter((p) => !p.is_starter)
    .sort((a, b) => b.xp_gw1 - a.xp_gw1);
  const captain = players.find((p) => p.is_captain)!;
  const vice =
    players.find((p) => p.is_vice) ??
    players.find((p) => !p.is_captain && p.is_starter)!;

  const spend_m =
    Math.round(players.reduce((s, p) => s + p.price, 0) * 10) / 10;
  const bank_m = Math.round((SQUAD_BUILDER_BUDGET_M - spend_m) * 10) / 10;
  const xi_xp =
    Math.round(
      starters.reduce(
        (s, p) => s + (p.is_captain ? p.xp_gw1 * 2 : p.xp_gw1),
        0,
      ) * 100,
    ) / 100;
  const avg_ownership =
    Math.round(
      (players.reduce((s, p) => s + p.ownership, 0) / Math.max(players.length, 1)) *
        10,
    ) / 10;
  const diff_count = players.filter((p) => p.ownership <= opts.diffMax).length;

  const formation = formationOf(starters);
  const why = buildWhy(
    opts.kind,
    opts.constraints,
    {
      formation,
      spend_m,
      bank_m,
      diff_count,
      avg_ownership,
      captain,
      excludedNames: opts.excludedNames,
      includedNames: opts.includedNames,
    },
    opts.diffMax,
  );

  const meta = OPTION_META[opts.kind];
  const pick_ids = toPlannerPicks(squadCands).map((p) => p.fpl_id);

  return {
    kind: opts.kind,
    label_en: meta.label_en,
    label_zh: meta.label_zh,
    formation,
    spend_m,
    bank_m,
    xi_xp,
    avg_ownership,
    diff_count,
    players,
    starters,
    bench,
    captain,
    vice,
    why_en: why.en,
    why_zh: why.zh,
    pick_ids,
    builder_path: squadBuilderHref({
      ids: pick_ids,
      captainId,
      viceId,
    }),
  };
}

function normalizeConstraints(
  raw: RecommendedSquadConstraints,
): RecommendedSquadConstraints {
  const style = (
    ["template", "balanced", "differential", "premium", "budget"] as const
  ).includes(raw.style as SquadStyle)
    ? raw.style
    : "balanced";

  const excludeIds = [...new Set((raw.excludeIds ?? []).filter((n) => n > 0))];
  const includeIds = [...new Set((raw.includeIds ?? []).filter((n) => n > 0))]
    .filter((id) => !excludeIds.includes(id))
    .slice(0, 3);

  const differentialMaxOwn =
    typeof raw.differentialMaxOwn === "number" &&
    Number.isFinite(raw.differentialMaxOwn)
      ? Math.min(25, Math.max(3, raw.differentialMaxOwn))
      : DEFAULT_DIFF_MAX_OWN;

  const minDifferentials =
    style === "differential"
      ? typeof raw.minDifferentials === "number"
        ? Math.min(10, Math.max(3, Math.round(raw.minDifferentials)))
        : DEFAULT_MIN_DIFFS
      : raw.minDifferentials;

  const horizon =
    typeof raw.horizon === "number" && Number.isFinite(raw.horizon)
      ? Math.min(8, Math.max(3, Math.round(raw.horizon)))
      : raw.goal === "set_and_forget"
        ? 8
        : 5;

  const goal = (
    ["gw1_5", "set_and_forget", "rank_chase"] as const
  ).includes(raw.goal as SquadGoal)
    ? raw.goal
    : "gw1_5";

  return {
    style,
    goal,
    excludeIds,
    includeIds,
    differentialMaxOwn,
    minDifferentials,
    horizon,
    diversitySalt:
      typeof raw.diversitySalt === "number" && Number.isFinite(raw.diversitySalt)
        ? Math.floor(raw.diversitySalt) >>> 0
        : undefined,
  };
}

export function parseRecommendedConstraints(
  body: unknown,
): RecommendedSquadConstraints {
  if (!body || typeof body !== "object") {
    return normalizeConstraints({ style: "balanced" });
  }
  const o = body as Record<string, unknown>;
  return normalizeConstraints({
    style: o.style as SquadStyle,
    goal: o.goal as SquadGoal | undefined,
    excludeIds: Array.isArray(o.excludeIds)
      ? o.excludeIds.map(Number).filter(Number.isFinite)
      : undefined,
    includeIds: Array.isArray(o.includeIds)
      ? o.includeIds.map(Number).filter(Number.isFinite)
      : undefined,
    differentialMaxOwn:
      typeof o.differentialMaxOwn === "number"
        ? o.differentialMaxOwn
        : undefined,
    minDifferentials:
      typeof o.minDifferentials === "number" ? o.minDifferentials : undefined,
    horizon: typeof o.horizon === "number" ? o.horizon : undefined,
    diversitySalt:
      typeof o.diversitySalt === "number"
        ? o.diversitySalt
        : typeof o.diversitySalt === "string" && Number.isFinite(Number(o.diversitySalt))
          ? Number(o.diversitySalt)
          : undefined,
  });
}

export async function buildRecommendedSquadPack(
  raw: RecommendedSquadConstraints,
  opts?: { pool?: Cand[]; gw?: number },
): Promise<RecommendedSquadPack> {
  const constraints = normalizeConstraints(raw);
  const horizon = constraints.horizon ?? 5;
  // Align with Squad Builder: always plan from GW1 in preseason/prep.
  const gw = opts?.gw ?? SQUAD_BUILDER_FROM_GW;

  const poolAll =
    opts?.pool ?? (await loadRecommendedPool({ fromGw: gw, horizon }));
  if (poolAll.length < 40) {
    throw new Error("Not enough projected players to build recommended squads.");
  }

  const excludeSet = new Set(constraints.excludeIds ?? []);
  const pool = poolAll.filter((c) => !excludeSet.has(c.fpl_id));
  const byId = new Map(poolAll.map((c) => [c.fpl_id, c]));

  const mustInclude: Cand[] = [];
  for (const id of constraints.includeIds ?? []) {
    const c = byId.get(id);
    if (!c) continue;
    if (excludeSet.has(id)) continue;
    mustInclude.push(c);
  }

  // Ensure must-include still in working pool.
  const workingBase = [
    ...pool,
    ...mustInclude.filter((c) => !pool.some((p) => p.fpl_id === c.fpl_id)),
  ];

  const excludedNames = (constraints.excludeIds ?? [])
    .map((id) => byId.get(id)?.web_name)
    .filter((n): n is string => Boolean(n));
  const includedNames = mustInclude.map((c) => c.web_name);
  const diffMax = constraints.differentialMaxOwn ?? DEFAULT_DIFF_MAX_OWN;

  const kinds: SquadOptionKind[] = ["safe", "balanced", "spicy"];
  const built: Cand[][] = [];
  const options: RecommendedSquadOption[] = [];
  const usedSoftPrefer = new Set<number>();
  const lockedIds = new Set(mustInclude.map((c) => c.fpl_id));
  const diversitySalt = constraints.diversitySalt ?? 0;

  const allIds = workingBase.map((c) => c.fpl_id);
  const fxMap = await nextFixtureForPlayers(allIds);

  for (const kind of kinds) {
    let squad: Cand[] | null = null;
    let lastOverlap = 99;

    for (let attempt = 0; attempt < 5; attempt++) {
      const banCount = BASE_BAN_COUNT + attempt * 2 + (kind === "spicy" ? 1 : 0);
      const banIds = pickBanIds(built, lockedIds, banCount, kind);
      // Also ban soft-prefers already used by earlier options so cores diverge.
      for (const id of usedSoftPrefer) {
        if (!lockedIds.has(id) && banIds.size < banCount + 6) banIds.add(id);
      }

      const workingPool = workingBase.filter((c) => !banIds.has(c.fpl_id));
      // Keep pool usable — if bans emptied it, fall back.
      const poolForBuild =
        workingPool.length >= 40 ? workingPool : workingBase;

      const styled = applyStylePool(
        poolForBuild,
        constraints.style,
        kind,
        diffMax,
        usedSoftPrefer,
        diversitySalt + attempt * 7919,
      );
      const seed = hashSeed([
        constraints.style,
        constraints.goal ?? "gw1_5",
        String(OPTION_META[kind].seedSalt),
        String(diversitySalt),
        String(attempt),
        (constraints.excludeIds ?? []).join(","),
        (constraints.includeIds ?? []).join(","),
        String(gw),
        String(horizon),
        [...banIds].sort((a, b) => a - b).join(","),
      ]);

      let candidate = buildBudgetSquad(
        styled.pool.map(toBudgetCand),
        seed,
        {
          mustInclude: mustInclude.map(toBudgetCand),
          softPreferIds: styled.softPreferIds,
          preferValue: styled.preferValue,
        },
      ).map(
        (b) =>
          byId.get(b.fpl_id) ?? workingBase.find((c) => c.fpl_id === b.fpl_id)!,
      );

      const wantDiffs =
        constraints.style === "differential"
          ? constraints.minDifferentials ?? DEFAULT_MIN_DIFFS
          : kind === "spicy"
            ? 5
            : 0;
      if (wantDiffs > 0) {
        candidate = nudgeMoreDifferentials(
          candidate,
          poolForBuild,
          wantDiffs,
          diffMax,
          mustInclude,
        );
      }

      if (!(constraints.style === "budget" && kind === "safe")) {
        candidate = forceSpendUpgrades(
          candidate,
          poolForBuild,
          mustInclude,
          constraints.style === "differential" || kind === "spicy",
          diffMax,
        );
      }

      if (candidate.length !== 15) continue;
      let badPos = false;
      for (const pos of POSITIONS) {
        if (candidate.filter((c) => c.position === pos).length !== NEED[pos]) {
          badPos = true;
          break;
        }
      }
      if (badPos) continue;

      let maxOverlap = 0;
      for (const prev of built) {
        maxOverlap = Math.max(
          maxOverlap,
          squadOverlap(candidate, prev, lockedIds),
        );
      }
      lastOverlap = maxOverlap;

      if (maxOverlap <= MAX_OPTION_OVERLAP || attempt === 4) {
        squad = candidate;
        for (const id of styled.softPreferIds) usedSoftPrefer.add(id);
        break;
      }
    }

    if (!squad || squad.length !== 15) {
      throw new Error(
        `Could not diversify ${kind} squad (last overlap ${lastOverlap}).`,
      );
    }

    built.push(squad);
    options.push(
      assembleOption(squad, {
        kind,
        gw,
        horizon,
        constraints,
        diffMax,
        excludedNames,
        includedNames,
        fxMap,
      }),
    );
  }

  return {
    gw,
    horizon,
    constraints,
    differential_max_own: diffMax,
    options,
  };
}

/** Swap non-locked high-ownership picks for cheaper/low-own alternatives when possible. */
function nudgeMoreDifferentials(
  squad: Cand[],
  pool: Cand[],
  wantDiffs: number,
  diffMax: number,
  locked: Cand[],
): Cand[] {
  const lockedIds = new Set(locked.map((c) => c.fpl_id));
  const out = [...squad];
  let diffs = out.filter((c) => c.ownership <= diffMax).length;
  if (diffs >= wantDiffs) return out;

  const clubCount = new Map<number, number>();
  for (const c of out) {
    clubCount.set(c.team_id, (clubCount.get(c.team_id) ?? 0) + 1);
  }
  let spend = out.reduce((s, c) => s + c.price, 0);

  const candidates = [...pool]
    .filter((c) => c.ownership <= diffMax)
    .sort((a, b) => b.xp_gw1 - a.xp_gw1);

  for (let i = 0; i < out.length && diffs < wantDiffs; i++) {
    const cur = out[i]!;
    if (lockedIds.has(cur.fpl_id)) continue;
    if (cur.ownership <= diffMax) continue;

    const used = new Set(out.map((c) => c.fpl_id));
    let best: Cand | null = null;
    for (const c of candidates) {
      if (used.has(c.fpl_id)) continue;
      if (c.position !== cur.position) continue;
      const clubsWithout = (clubCount.get(cur.team_id) ?? 1) - 1;
      const clubsWith =
        c.team_id === cur.team_id
          ? clubsWithout + 1
          : (clubCount.get(c.team_id) ?? 0) + 1;
      if (clubsWith > 3) continue;
      const newSpend = spend - cur.price + c.price;
      if (newSpend > SQUAD_BUILDER_BUDGET_M + 1e-9) continue;
      if (!best || c.xp_gw1 > best.xp_gw1) best = c;
    }
    if (!best) continue;

    clubCount.set(cur.team_id, (clubCount.get(cur.team_id) ?? 1) - 1);
    clubCount.set(best.team_id, (clubCount.get(best.team_id) ?? 0) + 1);
    spend = spend - cur.price + best.price;
    out[i] = best;
    diffs += 1;
  }

  return out;
}

/** Spend remaining bank on same-position upgrades (non-locked). */
function forceSpendUpgrades(
  squad: Cand[],
  pool: Cand[],
  locked: Cand[],
  preferDiffs: boolean,
  diffMax: number,
): Cand[] {
  const lockedIds = new Set(locked.map((c) => c.fpl_id));
  const out = [...squad];
  const clubCount = new Map<number, number>();
  for (const c of out) {
    clubCount.set(c.team_id, (clubCount.get(c.team_id) ?? 0) + 1);
  }
  let spend = out.reduce((s, c) => s + c.price, 0);
  let bank = SQUAD_BUILDER_BUDGET_M - spend;
  let improved = true;
  let guard = 0;

  while (improved && bank >= 0.5 && guard < 40) {
    improved = false;
    guard += 1;
    for (let i = 0; i < out.length; i++) {
      const cur = out[i]!;
      if (lockedIds.has(cur.fpl_id)) continue;
      const used = new Set(out.map((c) => c.fpl_id));
      let best: Cand | null = null;
      let bestScore = -Infinity;
      for (const c of pool) {
        if (used.has(c.fpl_id)) continue;
        if (c.position !== cur.position) continue;
        const cost = c.price - cur.price;
        if (cost <= 0.05 || cost > bank + 1e-9) continue;
        const clubsWithout = (clubCount.get(cur.team_id) ?? 1) - 1;
        const clubsWith =
          c.team_id === cur.team_id
            ? clubsWithout + 1
            : (clubCount.get(c.team_id) ?? 0) + 1;
        if (clubsWith > 3) continue;
        const diffBonus =
          preferDiffs && c.ownership <= diffMax
            ? 1.5
            : preferDiffs && c.ownership > diffMax
              ? -0.8
              : 0;
        const score = c.xp_gw1 - cur.xp_gw1 + diffBonus + cost * 0.02;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (best && bestScore > 0.05) {
        clubCount.set(cur.team_id, (clubCount.get(cur.team_id) ?? 1) - 1);
        clubCount.set(best.team_id, (clubCount.get(best.team_id) ?? 0) + 1);
        bank -= best.price - cur.price;
        out[i] = best;
        improved = true;
      }
    }
  }
  return out;
}
