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

export type DailyGw1Draft = {
  card_date: string;
  gw: number;
  horizon: number;
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
 * Greedy £100m squad: fill positions by value (xP / price) with club cap,
 * then upgrade to best remaining XP within leftover budget.
 */
export function buildBudgetSquad(
  pool: Cand[],
  seed: number,
  budget = SQUAD_BUILDER_BUDGET_M,
): Cand[] {
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
    const value = c.xp_gw1 / Math.max(c.price, 4);
    return scoreWithSeed(value * 10 + c.xp_gw1 * 0.15, c.fpl_id, seed);
  };

  const canTake = (c: Cand) => {
    if (needLeft[c.position] <= 0) return false;
    if (spend + c.price > budget + 1e-9) return false;
    if ((clubCount.get(c.team_id) ?? 0) >= 3) return false;
    return true;
  };

  const remaining = [...pool].sort((a, b) => valueKey(b) - valueKey(a));

  // Pass 1: fill by value
  for (const c of remaining) {
    if (picked.length >= 15) break;
    if (!canTake(c)) continue;
    picked.push(c);
    spend += c.price;
    needLeft[c.position] -= 1;
    clubCount.set(c.team_id, (clubCount.get(c.team_id) ?? 0) + 1);
  }

  // Pass 2: fill any missing slots with cheapest eligible
  if (picked.length < 15) {
    const ids = new Set(picked.map((p) => p.fpl_id));
    const cheap = [...pool]
      .filter((c) => !ids.has(c.fpl_id))
      .sort((a, b) => a.price - b.price || b.xp_gw1 - a.xp_gw1);
    for (const c of cheap) {
      if (picked.length >= 15) break;
      if (!canTake(c)) continue;
      picked.push(c);
      spend += c.price;
      needLeft[c.position] -= 1;
      clubCount.set(c.team_id, (clubCount.get(c.team_id) ?? 0) + 1);
    }
  }

  // Pass 3: upgrade — replace with higher GW1 xP within bank
  let bank = budget - spend;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < picked.length; i++) {
      const cur = picked[i];
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
        const delta =
          scoreWithSeed(c.xp_gw1, c.fpl_id, seed) -
          scoreWithSeed(cur.xp_gw1, cur.fpl_id, seed);
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

function templateRationale(draft: Omit<DailyGw1Draft, "rationale_en" | "rationale_zh">): {
  en: string;
  zh: string;
} {
  const cap = draft.captain;
  const vice = draft.vice;
  const cheap = [...draft.players]
    .filter((p) => p.price <= 5.5)
    .sort((a, b) => b.xp_gw1 - a.xp_gw1)[0];
  const premium = [...draft.starters]
    .sort((a, b) => b.price - a.price)[0];

  const en = [
    `## Why this GW${draft.gw} draft`,
    `- Formation **${draft.formation}** maximises GW${draft.gw} xP under £${draft.budget_m.toFixed(1)}m (spend £${draft.spend_m.toFixed(1)}m, bank £${draft.bank_m.toFixed(1)}m).`,
    `- **Captain ${cap.web_name}** (${cap.fixture ?? "GW1"}) — highest projected starter xP (${cap.xp_gw1.toFixed(1)}).`,
    `- **Vice ${vice.web_name}** (${vice.fixture ?? "GW1"}) — coverage if the captain blanks.`,
    premium
      ? `- Premium anchor: **${premium.web_name}** (£${premium.price.toFixed(1)}m) for ceiling.`
      : null,
    cheap
      ? `- Enabler: **${cheap.web_name}** (£${cheap.price.toFixed(1)}m) frees budget for attackers.`
      : null,
    `- Bench ordered by GW${draft.gw} xP; XI re-optimised daily from live projections.`,
  ]
    .filter(Boolean)
    .join("\n");

  const zh = [
    `## 为什么选这套 GW${draft.gw} 阵容`,
    `- **${draft.formation}** 阵型：在 £${draft.budget_m.toFixed(1)}m 预算内最大化 GW${draft.gw} xP（花费 £${draft.spend_m.toFixed(1)}m，余额 £${draft.bank_m.toFixed(1)}m）。`,
    `- **队长 ${cap.web_name}**（${cap.fixture ?? "GW1"}）— 首发中预计 xP 最高（${cap.xp_gw1.toFixed(1)}）。`,
    `- **副队 ${vice.web_name}**（${vice.fixture ?? "GW1"}）— 队长失手时的保底。`,
    premium
      ? `- 贵价核心：**${premium.web_name}**（£${premium.price.toFixed(1)}m）拉高上限。`
      : null,
    cheap
      ? `- 廉价支点：**${cheap.web_name}**（£${cheap.price.toFixed(1)}m）腾出预算给进攻线。`
      : null,
    `- 替补按 GW${draft.gw} xP 排序；每日用最新投影重算首发。`,
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

Squad (GW${draft.gw}, formation ${draft.formation}, spend £${draft.spend_m}m / bank £${draft.bank_m}m):
${roster}

Return Markdown with TWO sections exactly:

## EN
- 5–7 short bullets in English: why this XI, captain/vice, key differentials or enablers, one risk. No fluff.

## ZH
- Same ideas in Simplified Chinese, 5–7 bullets.

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
      en: `## Why this GW${draft.gw} draft\n${en}`,
      zh: `## 为什么选这套 GW${draft.gw} 阵容\n${zh}`,
    };
  } catch {
    return null;
  }
}

export async function buildDailyGw1Draft(opts?: {
  cardDate?: string;
  gw?: number;
  horizon?: number;
}): Promise<DailyGw1Draft> {
  const cardDate = opts?.cardDate ?? shanghaiDateIso();
  const horizon = opts?.horizon ?? 5;
  const { next, current } = await resolveCurrentGw();
  const gw =
    opts?.gw ??
    (next >= 1 ? next : current >= 1 ? current : 1);

  const seed = dateSeed(cardDate);
  const pool = await loadCandidates(gw, horizon);
  if (pool.length < 40) {
    throw new Error("Not enough projected players to build a draft.");
  }

  const squadCands = buildBudgetSquad(pool, seed);
  if (squadCands.length !== 15) {
    throw new Error(`Draft incomplete: ${squadCands.length}/15 players.`);
  }

  const picks = toPlannerPicks(squadCands);
  const xpByFid: Record<string, number> = {};
  for (const c of squadCands) xpByFid[String(c.fpl_id)] = c.xp_gw1;

  const xiIds = findBestXiByXp(picks, xpByFid);
  if (!xiIds || xiIds.length !== 11) {
    throw new Error("Could not optimise a legal GW1 XI.");
  }
  const xiSet = new Set(xiIds);

  const fxMap = await nextFixtureForPlayers(squadCands.map((c) => c.fpl_id));
  const byId = new Map(squadCands.map((c) => [c.fpl_id, c]));

  const rankedXi = [...xiIds]
    .map((id) => byId.get(id)!)
    .sort((a, b) => b.xp_gw1 - a.xp_gw1);
  const captainId = rankedXi[0]!.fpl_id;
  const viceId = rankedXi[1]?.fpl_id ?? captainId;

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
  const vice = players.find((p) => p.is_vice) ?? players.find((p) => !p.is_captain && p.is_starter)!;

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

  const base = {
    card_date: cardDate,
    gw,
    horizon,
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
  };

  const gemini = await geminiRationale(base);
  const fallback = templateRationale(base);

  return {
    ...base,
    rationale_en: gemini?.en ?? fallback.en,
    rationale_zh: gemini?.zh ?? fallback.zh,
  };
}

export function resolveDraftSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://www.faleague-ai.com"
  );
}
