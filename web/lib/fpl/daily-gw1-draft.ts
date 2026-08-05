import { chunkArray } from "@/lib/chunk";
import { getServerSupabase } from "@/lib/supabase";
import {
  findBestXiByXp,
} from "@/lib/planner/optimize-xi";
import type { PlannerPickPayload } from "@/components/planner/types";
import {
  createEmptySquad,
  SQUAD_BUILDER_BUDGET_M,
} from "@/lib/squad-builder/slots";
import {
  nextFixtureForPlayers,
  projectPlayers,
  resolveCurrentGw,
  type PlayerProjection,
} from "@/lib/xp";
import { DEFAULT_MODEL, getGenAI } from "@/lib/llm";
import { shanghaiDateIso } from "@/lib/fpl/wechat-daily-card";

const NEED = { GKP: 2, DEF: 5, MID: 5, FWD: 3 } as const;
const POSITIONS = ["GKP", "DEF", "MID", "FWD"] as const;
const LEAGUE_CHUNK = 80;

export type DailyDraftPlayer = {
  fpl_id: number;
  web_name: string;
  team: string;
  team_id: number;
  team_code: number | null;
  team_short: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  price: number;
  xp_gw1: number;
  xp_horizon: number;
  fixture: string | null;
  is_starter: boolean;
  is_captain: boolean;
  is_vice: boolean;
  shirt_url: string;
};

export type DailyDraftThemeId =
  | "template"
  | "promising"
  | "boosting";

export type DailyDraftTheme = {
  id: DailyDraftThemeId;
  title_en: string;
  title_zh: string;
  hook_en: string;
  hook_zh: string;
};

export const DRAFT_THEMES: DailyDraftTheme[] = [
  {
    id: "template",
    title_en: "Template stack",
    title_zh: "模板核心阵",
    hook_en: "Max GW xP under £100m — the “safe” talking point.",
    hook_zh: "£100m 内最大化本轮 xP — 最稳的讨论起点。",
  },
  {
    id: "promising",
    title_en: "Promising (no Haaland)",
    title_zh: "无 Haaland 潜力阵",
    hook_en: "Skip the £15m+ template forward — fund differentials & midfield.",
    hook_zh: "放弃贵价中锋模板，把预算砸进中场与差分。",
  },
  {
    id: "boosting",
    title_en: "Boosting triple stack",
    title_zh: "三核加强阵",
    hook_en: "Haaland + premium mid + premium def — built for a big chip week.",
    hook_zh: "Haaland + 贵价中场 + 贵价后卫 — 为大芯片周蓄力。",
  },
];

export type DailyGw1Draft = {
  card_date: string;
  gw: number;
  horizon: number;
  theme: DailyDraftTheme;
  formation: string;
  budget_m: number;
  spend_m: number;
  bank_m: number;
  xi_xp: number;
  squad_xp_horizon: number;
  players: DailyDraftPlayer[];
  starters: DailyDraftPlayer[];
  bench: DailyDraftPlayer[];
  captain: DailyDraftPlayer;
  vice: DailyDraftPlayer;
  rationale_en: string;
  rationale_zh: string;
  /** Short share line for WeChat. */
  talking_point_zh: string;
  talking_point_en: string;
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

function formationOf(starters: DailyDraftPlayer[]): string {
  const d = starters.filter((p) => p.position === "DEF").length;
  const m = starters.filter((p) => p.position === "MID").length;
  const f = starters.filter((p) => p.position === "FWD").length;
  return `${d}-${m}-${f}`;
}

/** Deterministic shuffle bias from YYYY-MM-DD so daily drafts can nudge ties. */
function dateSeed(iso: string): number {
  let h = 0;
  for (let i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) >>> 0;
  return h || 1;
}

function scoreWithSeed(xp: number, fplId: number, seed: number): number {
  const jitter = ((fplId * 17 + seed) % 1000) / 100000;
  return xp + jitter;
}

type Cand = {
  fpl_id: number;
  web_name: string;
  team: string;
  team_id: number;
  team_code: number | null;
  team_short: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  price: number;
  xp_gw1: number;
  xp_horizon: number;
  status: string | null;
};

async function loadCandidates(
  fromGw: number,
  horizon: number,
): Promise<Cand[]> {
  const toGw = fromGw + horizon - 1;
  const supa = getServerSupabase();
  const [{ data: players, error }, { data: teams }] = await Promise.all([
    supa
      .from("players_static")
      .select(
        "fpl_id,web_name,name,team,team_id,position,base_price,status,chance_of_playing",
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
      xp_gw1: Math.round(xp_gw1 * 100) / 100,
      xp_horizon: Math.round(xp_horizon * 100) / 100,
      status,
    });
  }
  return out;
}

/**
 * Greedy £100m squad: lock anchors → value fill (with slot-cost reserve) →
 * cheap backfill → upgrade by xP. Reserve keeps a legal 15 when stacking premiums.
 */
export function buildBudgetSquad(
  pool: Cand[],
  seed: number,
  opts?: {
    budget?: number;
    mustInclude?: Cand[];
    /** Prefer these IDs early without hard-locking (theme flavour). */
    softPreferIds?: number[];
    /** Prefer value (xP/£) over raw xP — good for “promising” builds. */
    preferValue?: boolean;
  },
): Cand[] {
  const budget = opts?.budget ?? SQUAD_BUILDER_BUDGET_M;
  const mustInclude = opts?.mustInclude ?? [];
  const softPrefer = new Set(opts?.softPreferIds ?? []);
  const preferValue = opts?.preferValue ?? false;

  const needLeft: Record<(typeof POSITIONS)[number], number> = {
    GKP: NEED.GKP,
    DEF: NEED.DEF,
    MID: NEED.MID,
    FWD: NEED.FWD,
  };
  const clubCount = new Map<number, number>();
  const picked: Cand[] = [];
  let spend = 0;

  const valueKey = (c: Cand) => {
    const soft = softPrefer.has(c.fpl_id) ? 50 : 0;
    if (preferValue) {
      const value = c.xp_gw1 / Math.max(c.price, 4);
      return scoreWithSeed(value * 14 + c.xp_gw1 * 0.08 + soft, c.fpl_id, seed);
    }
    const value = c.xp_gw1 / Math.max(c.price, 4);
    return scoreWithSeed(value * 10 + c.xp_gw1 * 0.15 + soft, c.fpl_id, seed);
  };

  /** Min cost of cheapest legal finish after optionally seating `extra`. */
  const minCostToFinish = (extra?: Cand) => {
    const need = { ...needLeft };
    const clubs = new Map(clubCount);
    const used = new Set(picked.map((p) => p.fpl_id));
    if (extra) {
      need[extra.position] -= 1;
      clubs.set(extra.team_id, (clubs.get(extra.team_id) ?? 0) + 1);
      used.add(extra.fpl_id);
    }
    const poolLeft = [...pool]
      .filter((c) => !used.has(c.fpl_id))
      .sort((a, b) => a.price - b.price || b.xp_gw1 - a.xp_gw1);
    let reserved = 0;
    for (const c of poolLeft) {
      if (need[c.position] <= 0) continue;
      if ((clubs.get(c.team_id) ?? 0) >= 3) continue;
      need[c.position] -= 1;
      clubs.set(c.team_id, (clubs.get(c.team_id) ?? 0) + 1);
      reserved += c.price;
    }
    const slotsLeft = POSITIONS.reduce((s, p) => s + need[p], 0);
    return slotsLeft > 0 ? Number.POSITIVE_INFINITY : reserved;
  };

  const canTake = (c: Cand, reserve = true) => {
    if (needLeft[c.position] <= 0) return false;
    if (spend + c.price > budget + 1e-9) return false;
    if ((clubCount.get(c.team_id) ?? 0) >= 3) return false;
    if (reserve) {
      const reserved = minCostToFinish(c);
      if (spend + c.price + reserved > budget + 1e-9) return false;
    }
    return true;
  };

  const seat = (c: Cand) => {
    picked.push(c);
    spend += c.price;
    needLeft[c.position] -= 1;
    clubCount.set(c.team_id, (clubCount.get(c.team_id) ?? 0) + 1);
  };

  // Seed locked players first (theme anchors).
  for (const c of mustInclude) {
    if (picked.some((p) => p.fpl_id === c.fpl_id)) continue;
    if (!canTake(c, false)) {
      throw new Error(
        `Cannot lock ${c.web_name} (£${c.price}m ${c.position}) into themed squad.`,
      );
    }
    seat(c);
  }

  const lockedIds = new Set(picked.map((p) => p.fpl_id));

  // Soft prefers: seat early while a legal finish still fits.
  for (const id of softPrefer) {
    if (picked.some((p) => p.fpl_id === id)) continue;
    const c = pool.find((p) => p.fpl_id === id);
    if (!c || !canTake(c)) continue;
    seat(c);
  }

  // Pass 1: fill by value, never strand an unfilled slot over budget.
  {
    const remaining = [...pool]
      .filter((c) => !picked.some((p) => p.fpl_id === c.fpl_id))
      .sort((a, b) => valueKey(b) - valueKey(a));
    for (const c of remaining) {
      if (picked.length >= 15) break;
      if (!canTake(c)) continue;
      seat(c);
    }
  }

  // Pass 2: cheap backfill for any leftover slots.
  if (picked.length < 15) {
    const ids = new Set(picked.map((p) => p.fpl_id));
    const cheap = [...pool]
      .filter((c) => !ids.has(c.fpl_id))
      .sort((a, b) => a.price - b.price || b.xp_gw1 - a.xp_gw1);
    for (const c of cheap) {
      if (picked.length >= 15) break;
      if (!canTake(c, false)) continue;
      seat(c);
    }
  }

  // Pass 3: upgrade — never drop locked anchors or soft theme prefers.
  const protectedIds = new Set([...lockedIds, ...softPrefer]);
  let bank = budget - spend;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < picked.length; i++) {
      const cur = picked[i];
      if (protectedIds.has(cur.fpl_id)) continue;
      const withoutClub = new Map(clubCount);
      withoutClub.set(cur.team_id, (withoutClub.get(cur.team_id) ?? 1) - 1);
      const ids = new Set(picked.map((p) => p.fpl_id));
      let best: Cand | null = null;
      let bestDelta = 0.05;
      for (const c of pool) {
        if (ids.has(c.fpl_id)) continue;
        if (c.position !== cur.position) continue;
        if ((withoutClub.get(c.team_id) ?? 0) >= 3) continue;
        const cost = c.price - cur.price;
        if (cost > bank + 1e-9) continue;
        const delta = preferValue
          ? valueKey(c) - valueKey(cur)
          : scoreWithSeed(c.xp_gw1, c.fpl_id, seed) -
            scoreWithSeed(cur.xp_gw1, cur.fpl_id, seed) +
            (softPrefer.has(c.fpl_id) ? 5 : 0);
        if (delta > bestDelta) {
          bestDelta = delta;
          best = c;
        }
      }
      if (best) {
        bank -= best.price - cur.price;
        clubCount.set(cur.team_id, (clubCount.get(cur.team_id) ?? 1) - 1);
        clubCount.set(best.team_id, (clubCount.get(best.team_id) ?? 0) + 1);
        picked[i] = best;
        improved = true;
      }
    }
  }

  return picked;
}

function findByNameHints(
  pool: Cand[],
  hints: RegExp[],
  position?: Cand["position"],
): Cand | null {
  const ranked = [...pool]
    .filter((c) => (position ? c.position === position : true))
    .filter((c) => hints.some((re) => re.test(c.web_name)))
    .sort((a, b) => b.price - a.price || b.xp_gw1 - a.xp_gw1);
  return ranked[0] ?? null;
}

function resolveThemeLocks(
  themeId: DailyDraftThemeId,
  pool: Cand[],
): {
  pool: Cand[];
  mustInclude: Cand[];
  softPrefer: Cand[];
  preferValue: boolean;
} {
  if (themeId === "promising") {
    const haaland = findByNameHints(pool, [/^Haaland$/i, /Haaland/i], "FWD");
    const filtered = haaland
      ? pool.filter((c) => c.fpl_id !== haaland.fpl_id)
      : pool.filter((c) => c.price < 14.5 || c.position !== "FWD");
    return {
      pool: filtered,
      mustInclude: [],
      softPrefer: [],
      preferValue: true,
    };
  }

  if (themeId === "boosting") {
    const haaland =
      findByNameHints(pool, [/^Haaland$/i, /Haaland/i], "FWD") ??
      [...pool]
        .filter((c) => c.position === "FWD")
        .sort((a, b) => b.price - a.price || b.xp_gw1 - a.xp_gw1)[0];

    // Prefer Bruno (B.Fernandes), not Mateus Fernandes / M.Fernandes.
    const mid =
      findByNameHints(
        pool,
        [/^B\.?\s*Fernandes$/i, /^Bruno F/i],
        "MID",
      ) ??
      findByNameHints(pool, [/^Salah$/i, /^Saka$/i, /^Palmer$/i], "MID") ??
      [...pool]
        .filter((c) => c.position === "MID" && c.price >= 10)
        .sort((a, b) => b.price - a.price || b.xp_gw1 - a.xp_gw1)[0];

    const def =
      findByNameHints(pool, [/^Gabriel$/i], "DEF") ??
      findByNameHints(pool, [/^Saliba$/i, /^Virgil$/i], "DEF") ??
      [...pool]
        .filter((c) => c.position === "DEF" && c.price >= 6)
        .sort((a, b) => b.price - a.price || b.xp_gw1 - a.xp_gw1)[0];

    const anchors = [haaland, mid, def].filter((c): c is Cand => Boolean(c));
    // Dedupe by id (e.g. if fallbacks collide).
    const seen = new Set<number>();
    const mustInclude: Cand[] = [];
    for (const c of anchors) {
      if (seen.has(c.fpl_id)) continue;
      seen.add(c.fpl_id);
      mustInclude.push(c);
    }

    return {
      pool,
      mustInclude,
      softPrefer: [],
      preferValue: false,
    };
  }

  return { pool, mustInclude: [], softPrefer: [], preferValue: false };
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

function talkingPoints(
  theme: DailyDraftTheme,
  lockedNames: string[],
  extras?: { captain?: string; formation?: string },
): { en: string; zh: string } {
  if (theme.id === "promising") {
    const star = extras?.captain ?? lockedNames[0] ?? "differentials";
    return {
      en: `Talking point: Promising squad without Haaland — ${star} leads the line?`,
      zh: `今日话题：无 Haaland 潜力阵 — 靠 ${star} 冲分行不行？`,
    };
  }
  if (theme.id === "boosting") {
    const names =
      lockedNames.slice(0, 3).join(" + ") || "Haaland 三核";
    return {
      en: `Talking point: Boosting stack — ${names}. Chip week?`,
      zh: `今日话题：三核加强阵 — ${names}，芯片周怎么用？`,
    };
  }
  const cap = extras?.captain ? ` · C ${extras.captain}` : "";
  return {
    en: `Talking point: Is this the template XI${cap}?`,
    zh: `今日话题：这是本轮模板队吗${extras?.captain ? `（C ${extras.captain}）` : ""}？`,
  };
}

function templateRationale(
  draft: Omit<DailyGw1Draft, "rationale_en" | "rationale_zh">,
): { en: string; zh: string } {
  const cap = draft.captain;
  const vice = draft.vice;
  const cheap = [...draft.players]
    .filter((p) => p.price <= 5.5)
    .sort((a, b) => b.xp_gw1 - a.xp_gw1)[0];
  const premium = [...draft.starters].sort((a, b) => b.price - a.price)[0];
  const theme = draft.theme;

  const themeBulletsEn: string[] = [];
  const themeBulletsZh: string[] = [];
  if (theme.id === "promising") {
    themeBulletsEn.push(
      `- **No Haaland** on purpose — budget recycled into midfield differentials and fixtures.`,
    );
    themeBulletsZh.push(
      `- **故意不买 Haaland** — 预算回流中场差分与赛程。`,
    );
  } else if (theme.id === "boosting") {
    const anchors =
      draft.talking_point_zh.match(/—\s*(.+?)，/)?.[1]?.split(/\s*\+\s*/) ??
      draft.players
        .filter((p) => p.price >= 6.5)
        .sort((a, b) => b.price - a.price)
        .slice(0, 3)
        .map((p) => p.web_name);
    themeBulletsEn.push(
      `- **Triple stack:** ${anchors.join(" + ")} — built to smash a Triple Captain / Bench Boost week.`,
    );
    themeBulletsZh.push(
      `- **三核加强：** ${anchors.join(" + ")} — 为大芯片（三队长 / 替补加分）周蓄力。`,
    );
  } else {
    themeBulletsEn.push(
      `- **Template lean:** chase the highest projected GW${draft.gw} xP without exotic constraints.`,
    );
    themeBulletsZh.push(
      `- **模板取向：** 无额外限制，直接追 GW${draft.gw} 最高投影 xP。`,
    );
  }

  const en = [
    `## ${theme.title_en}`,
    `- ${theme.hook_en}`,
    ...themeBulletsEn,
    `- Formation **${draft.formation}** · spend £${draft.spend_m.toFixed(1)}m · bank £${draft.bank_m.toFixed(1)}m · XI xP ${draft.xi_xp.toFixed(1)}.`,
    `- **Captain ${cap.web_name}** (${cap.fixture ?? `GW${draft.gw}`}) — ${cap.xp_gw1.toFixed(1)} xP.`,
    `- **Vice ${vice.web_name}** (${vice.fixture ?? `GW${draft.gw}`}).`,
    cheap
      ? `- Enabler: **${cheap.web_name}** (£${cheap.price.toFixed(1)}m).`
      : null,
    premium && theme.id !== "boosting"
      ? `- Premium: **${premium.web_name}** (£${premium.price.toFixed(1)}m).`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const zh = [
    `## ${theme.title_zh}`,
    `- ${theme.hook_zh}`,
    ...themeBulletsZh,
    `- **${draft.formation}** · 花费 £${draft.spend_m.toFixed(1)}m · 余额 £${draft.bank_m.toFixed(1)}m · 首发 xP ${draft.xi_xp.toFixed(1)}。`,
    `- **队长 ${cap.web_name}**（${cap.fixture ?? `GW${draft.gw}`}）— ${cap.xp_gw1.toFixed(1)} xP。`,
    `- **副队 ${vice.web_name}**（${vice.fixture ?? `GW${draft.gw}`}）。`,
    cheap
      ? `- 廉价支点：**${cheap.web_name}**（£${cheap.price.toFixed(1)}m）。`
      : null,
    premium && theme.id !== "boosting"
      ? `- 贵价点：**${premium.web_name}**（£${premium.price.toFixed(1)}m）。`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { en, zh };
}

async function geminiRationale(
  draft: Omit<DailyGw1Draft, "rationale_en" | "rationale_zh">,
): Promise<{ en: string; zh: string } | null> {
  try {
    if (!process.env.GEMINI_API_KEY?.trim()) return null;
    const ai = await getGenAI();
    const roster = draft.players
      .map(
        (p) =>
          `${p.is_starter ? "XI" : "BN"} ${p.position} ${p.web_name} (${p.team_short}) £${p.price} fx=${p.fixture ?? "?"} xp=${p.xp_gw1}${p.is_captain ? " C" : ""}${p.is_vice ? " V" : ""}`,
      )
      .join("\n");

    const prompt = `You write FALEAGUE's daily FPL draft rationale for WeChat managers.

Theme: ${draft.theme.title_en} / ${draft.theme.title_zh}
Hook: ${draft.theme.hook_en}
Talking point: ${draft.talking_point_en}

Squad (GW${draft.gw}, formation ${draft.formation}, spend £${draft.spend_m}m / bank £${draft.bank_m}m):
${roster}

Return Markdown with TWO sections exactly:

## EN
- 5–7 short bullets in English. Lead with the theme/talking point. Mention captain/vice and one risk.

## ZH
- Same ideas in Simplified Chinese, 5–7 bullets. Lead with the theme.

Rules: facts only from the roster; mention player names; do not invent injuries.`;

    const resp = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.4 },
    });
    const text = (resp.candidates?.[0]?.content?.parts ?? [])
      .map((p) => ("text" in p ? p.text : ""))
      .join("")
      .trim();
    if (!text) return null;

    const enMatch = text.match(/##\s*EN\s*([\s\S]*?)(?=##\s*ZH|$)/i);
    const zhMatch = text.match(/##\s*ZH\s*([\s\S]*?)$/i);
    const en = enMatch?.[1]?.trim();
    const zh = zhMatch?.[1]?.trim();
    if (!en || !zh) return null;
    return {
      en: `## ${draft.theme.title_en}\n${en}`,
      zh: `## ${draft.theme.title_zh}\n${zh}`,
    };
  } catch {
    return null;
  }
}

async function assembleDraftFromSquad(
  squadCands: Cand[],
  opts: {
    cardDate: string;
    gw: number;
    horizon: number;
    theme: DailyDraftTheme;
    lockedNames: string[];
  },
): Promise<DailyGw1Draft> {
  const picks = toPlannerPicks(squadCands);
  const xpByFid: Record<string, number> = {};
  for (const c of squadCands) xpByFid[String(c.fpl_id)] = c.xp_gw1;

  const xiIds = findBestXiByXp(picks, xpByFid);
  if (!xiIds || xiIds.length !== 11) {
    throw new Error(`Could not optimise XI for theme ${opts.theme.id}.`);
  }
  const xiSet = new Set(xiIds);

  const fxMap = await nextFixtureForPlayers(squadCands.map((c) => c.fpl_id));
  const byId = new Map(squadCands.map((c) => [c.fpl_id, c]));

  const rankedXi = [...xiIds]
    .map((id) => byId.get(id)!)
    .sort((a, b) => b.xp_gw1 - a.xp_gw1);
  let captainId = rankedXi[0]!.fpl_id;
  let viceId = rankedXi[1]?.fpl_id ?? captainId;

  // Boosting theme: armband on Haaland when he starts.
  if (opts.theme.id === "boosting") {
    const haalandStarter = rankedXi.find((c) => /Haaland/i.test(c.web_name));
    if (haalandStarter) {
      captainId = haalandStarter.fpl_id;
      viceId =
        rankedXi.find((c) => c.fpl_id !== captainId)?.fpl_id ?? captainId;
    }
  }

  const players: DailyDraftPlayer[] = squadCands
    .map((c) => {
      const fx = fxMap.get(c.fpl_id);
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
  const squad_xp_horizon =
    Math.round(players.reduce((s, p) => s + p.xp_horizon, 0) * 100) / 100;

  const talk = talkingPoints(opts.theme, opts.lockedNames, {
    captain: captain.web_name,
    formation: formationOf(starters),
  });

  const base: Omit<DailyGw1Draft, "rationale_en" | "rationale_zh"> = {
    card_date: opts.cardDate,
    gw: opts.gw,
    horizon: opts.horizon,
    theme: opts.theme,
    formation: formationOf(starters),
    budget_m: SQUAD_BUILDER_BUDGET_M,
    spend_m,
    bank_m,
    xi_xp,
    squad_xp_horizon,
    players,
    starters,
    bench,
    captain,
    vice,
    talking_point_en: talk.en,
    talking_point_zh: talk.zh,
  };

  const gemini = await geminiRationale(base);
  const fallback = templateRationale(base);

  return {
    ...base,
    rationale_en: gemini?.en ?? fallback.en,
    rationale_zh: gemini?.zh ?? fallback.zh,
  };
}

export async function buildDailyGw1Draft(opts?: {
  cardDate?: string;
  gw?: number;
  horizon?: number;
  themeId?: DailyDraftThemeId;
  /** Preloaded pool — avoids re-projecting when building a pack. */
  pool?: Cand[];
}): Promise<DailyGw1Draft> {
  const cardDate = opts?.cardDate ?? shanghaiDateIso();
  const horizon = opts?.horizon ?? 5;
  const { next, current } = await resolveCurrentGw();
  const gw =
    opts?.gw ??
    (next >= 1 ? next : current >= 1 ? current : 1);

  const theme =
    DRAFT_THEMES.find((t) => t.id === opts?.themeId) ?? DRAFT_THEMES[0]!;

  const seed = dateSeed(`${cardDate}:${theme.id}`);
  const pool = opts?.pool ?? (await loadCandidates(gw, horizon));
  if (pool.length < 40) {
    throw new Error("Not enough projected players to build a draft.");
  }

  const locks = resolveThemeLocks(theme.id, pool);
  let squadCands: Cand[] = [];

  const must = locks.mustInclude;
  const softIds = locks.softPrefer.map((c) => c.fpl_id);
  const attempts: Array<{ must: Cand[]; soft: number[] }> = [
    { must, soft: softIds },
  ];
  // Budget waterfall: drop least-critical anchors first.
  if (must.length >= 3) {
    attempts.push({ must: must.slice(0, 2), soft: softIds });
    attempts.push({
      must: [must[0]!, must[2]!].filter(Boolean),
      soft: softIds,
    });
  }
  if (must.length >= 1) {
    attempts.push({ must: must.slice(0, 1), soft: softIds });
    attempts.push({ must: must.slice(0, 1), soft: [] });
  }
  attempts.push({ must: [], soft: softIds });
  attempts.push({ must: [], soft: [] });

  let usedLocks: Cand[] = [];
  for (const attempt of attempts) {
    try {
      squadCands = buildBudgetSquad(locks.pool, seed, {
        mustInclude: attempt.must,
        softPreferIds: attempt.soft,
        preferValue: locks.preferValue,
      });
      if (squadCands.length === 15) {
        usedLocks = attempt.must;
        break;
      }
    } catch {
      // try next attempt
    }
  }
  if (squadCands.length !== 15) {
    throw new Error(
      `Draft incomplete (${theme.id}): ${squadCands.length}/15 players.`,
    );
  }

  // Talking-point names: locked anchors that made the squad, else standout starters.
  const talkNames = (
    usedLocks.length > 0
      ? usedLocks
      : [...squadCands]
          .filter((c) => c.position !== "GKP")
          .sort((a, b) => b.price - a.price || b.xp_gw1 - a.xp_gw1)
          .slice(0, 3)
  ).map((c) => c.web_name);
  const uniqTalk = [...new Set(talkNames)];

  return assembleDraftFromSquad(squadCands, {
    cardDate,
    gw,
    horizon,
    theme,
    lockedNames: uniqTalk,
  });
}

/** Build all themed drafts for the day (shared projection pass). */
export async function buildDailyGw1DraftPack(opts?: {
  cardDate?: string;
  gw?: number;
  horizon?: number;
}): Promise<DailyGw1Draft[]> {
  const cardDate = opts?.cardDate ?? shanghaiDateIso();
  const horizon = opts?.horizon ?? 5;
  const { next, current } = await resolveCurrentGw();
  const gw =
    opts?.gw ??
    (next >= 1 ? next : current >= 1 ? current : 1);

  const pool = await loadCandidates(gw, horizon);
  const drafts: DailyGw1Draft[] = [];
  for (const theme of DRAFT_THEMES) {
    try {
      drafts.push(
        await buildDailyGw1Draft({
          cardDate,
          gw,
          horizon,
          themeId: theme.id,
          pool,
        }),
      );
    } catch (e) {
      console.warn(
        `[draft] theme ${theme.id} failed:`,
        e instanceof Error ? e.message : e,
      );
    }
  }
  if (!drafts.length) {
    throw new Error("All themed drafts failed.");
  }
  return drafts;
}

export function resolveDraftSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://www.faleague-ai.com"
  );
}
