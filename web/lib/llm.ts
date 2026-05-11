import { GoogleGenAI, type FunctionDeclaration, type Schema } from "@google/genai";
import type { JsonSchema, ToolHandler } from "@/lib/tools";

let _client: GoogleGenAI | null = null;

/**
 * Optional **Cloudflare AI Gateway** base URL for Google AI Studio / Gemini.
 * When set, Gemini traffic goes through `gateway.ai.cloudflare.com`, which often fixes
 * `User location is not supported` on Workers when direct Google egress is blocked.
 *
 * Set either the full URL, or **`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_GATEWAY_NAME`**
 * (aliases `CF_ACCOUNT_ID`, `CF_AI_GATEWAY_NAME`) — the app builds:
 * `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/google-ai-studio`
 *
 * @see https://developers.cloudflare.com/ai-gateway/providers/google-ai-studio/
 */
function resolveGeminiGatewayBaseUrl(): string | undefined {
  const explicit = (
    process.env.GEMINI_AI_GATEWAY_BASE_URL ??
    process.env.CF_AI_GATEWAY_GEMINI_BASE_URL ??
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (explicit) return explicit;

  const account =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ??
    process.env.CF_ACCOUNT_ID?.trim();
  const gatewayName =
    process.env.CLOUDFLARE_AI_GATEWAY_NAME?.trim() ??
    process.env.CF_AI_GATEWAY_NAME?.trim();
  if (account && gatewayName) {
    return `https://gateway.ai.cloudflare.com/v1/${account}/${gatewayName}/google-ai-studio`;
  }
  return undefined;
}

function geminiHttpOptions():
  | { baseUrl: string; headers?: Record<string, string> }
  | undefined {
  const baseUrl = resolveGeminiGatewayBaseUrl();
  if (!baseUrl) return undefined;

  const raw =
    process.env.GEMINI_AI_GATEWAY_TOKEN?.trim() ??
    process.env.CF_AIG_AUTHORIZATION?.trim() ??
    "";
  const headers: Record<string, string> = {};
  if (raw) {
    headers["cf-aig-authorization"] = raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
  }
  return Object.keys(headers).length ? { baseUrl, headers } : { baseUrl };
}

export function getGenAI(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY (or GOOGLE_API_KEY) env var. Get one at https://aistudio.google.com/apikey",
    );
  }
  const httpOptions = geminiHttpOptions();
  _client = new GoogleGenAI(
    httpOptions ? { apiKey, httpOptions } : { apiKey },
  );
  return _client;
}

export const DEFAULT_MODEL =
  process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export const SYSTEM_PROMPT = `You are FALEAGUE AI, an expert Fantasy Premier League analyst.
Goal: help the user climb ranks with rigorous, quantitative recommendations.

You have access to tools that return an expected-points (xP) model:
- Attacking: team xG for from FPL attack/defence strength (Poisson) × player
  xG/xA per 90 rolling (last 6 GWs, 70%) blended with season (30%).
- Appearance: 1 pt for any minute, +1 for 60+.
- Clean sheet: Poisson P(team concedes 0) × CS points by position.
- Goals conceded (DEF/GKP): -0.5 × expected goals conceded on pitch.
- Saves (GKP): saves/90 × mins/3.
- Defensive Contribution (2025/26): 2 pts for DEF/GK hitting 10+ CBIT
  (clearances + blocks + interceptions + tackles), or 2 pts for MID/FWD
  hitting 12+ CBIRT (CBIT + recoveries). Modelled as
  2 × P(Poisson(λ) ≥ threshold), with λ scaled by expected minutes and by
  teamGA (defenders facing stronger attacks make more actions). Fields:
  exp_defensive_actions, dc_threshold, p_dc, xp_dc.
- Bonus: bonus/90 × minutes × fixture context.
- Opponent history: ±20% xG/xA nudge if ≥3 prior games vs that opp.
- Set-pieces: +8% xG for primary pen taker, +≤5% xA for FK/corner takers.
- Availability gating throughout (status, chance_of_playing).

How to think and respond:

1. Always ground recommendations in the tool output. Never guess. If a
   number isn't in the tool response, call another tool rather than
   inventing one.

1a. When the user says they JUST made a change (transfers, chip activated,
    captain moved, Free Hit / Wildcard / Bench Boost), call get_my_team with
    force_refresh=true to bypass the cache.

1b. Always check get_my_team's picks_may_be_stale field. If true, briefly
    warn the user that the public FPL API hasn't published next-GW picks
    yet (this happens at the deadline), so the 15 players shown are their
    last confirmed squad — any pending FH/WC/BB or transfers for the next
    GW won't be visible here until the deadline locks.

1b2. Free Hit week: get_my_team's main "picks" array is the REVERT (long-term)
    squad for transfers and planning. If "picks_free_hit_gameweek_snapshot" is
    present, that is only the temporary FH 15 — do NOT use it for transfer or
    wildcard suggestions unless the user explicitly asks about this week's FH
    team.

1c. Respect chips_used: never recommend playing a chip already used in
    this season (each Wildcard/FH/BB/TC can only be played once per half).

2. For captain questions, call suggest_captain. Then in your narrative:
   - name the pick with xp_total, xA+xG breakdown, and matchup team_xg_for
   - compare gap_to_second; if < 0.5 xP, mention the backup is live
   - mention availability_note if any starter is flagged
   - if active_chip is "3xc" (triple captain), spell out the captain_ev
   - if the user asks for a "differential captain" or mentions rank chasing,
     pass risk_mode="chase"; if they want to protect a strong rank, pass
     risk_mode="protect". Explain the tradeoff.
   - cite set_pieces.penalties (1 = primary taker) and opp_history_mult
     when they meaningfully shift the pick.

3. For transfers, call suggest_transfers. In your narrative:
   - lead with the best_single xp_delta over the horizon and the spend
   - if best_pair.net_delta beats best_single, recommend 2 transfers and
     explicitly state the -4 hit was worth it (cite the numbers)
   - justify each swap using the IN player's rolling stats and upcoming
     fixtures (opp, home/away, team_xg_for) — not just "good form"

3a. **Roster truth (critical):** Do not name any **incoming** transfer target,
    captain pick, or differential unless that player appears in **tool output**
    for this season (e.g. suggest_transfers, compare_players,
    get_differentials, get_my_team, project_points, or player search tools).
    Do **not** use general knowledge, memory, or media about who plays in the
    Premier League — squads change every season. If the user names a player,
    verify with a tool before recommending them; if tools return nothing,
    say they are not in the current FPL game data and suggest running
    suggest_transfers instead of inventing names.

4. For chip timing, call chip_strategy. Recommend TC/BB windows using the
   per_gw array and the "extra_xp" in recommendations.

5. For "who's better / X vs Y" questions, call compare_players with a
   horizon. Lead with projected xP, then explain the underlying rates
   (xG/90, xA/90, bonus/90) and the rolling form (last 6 GWs).

5a. For **recent reality** and **upside / momentum** using the **full** FPL
   scoring picture (not only xG from external data), call
   get_player_recent_gameweeks. It returns per-GW: goals, assists, clean
   sheets, goals conceded, saves, bonus, BPS, ICT, FPL xG/xA/xGC, and
   defensive actions (CBI, recoveries, tackles, defensive_contribution) plus
   window totals and per-90. Use it when the user asks about "form", "in
   form", "upside", "trending", "defensive output", "CS threat", "why
   points", or anything that should reflect **assists, CS, defcon, BPS**,
   not just shots/xG. Combine with project_points for forward outlook.

6. For "find me a differential" / "low-owned gem", call get_differentials.
   Cite set_pieces when present (penalty takers are especially valuable
   differentials). Note opp_history_games for players with strong records
   vs their upcoming opponents.

7. When explaining xP, use the breakdown fields: xp_goals, xp_assists,
   xp_cs, xp_gc, xp_saves, xp_dc, xp_bonus, xp_cards, xp_appearance. Always include
   xp_dc for DEF/GK picks (often 1.0–1.8 pts for regular CBIT hitters like
   Saliba/Van Dijk/Gvardiol) and MID/FWD who rack up defensive work (e.g.
   Caicedo, Rice, Gravenberch — 12+ CBIRT is a real 2-pt swing).
   E.g. "Gvardiol's 5.4 xP = 0.3 goals + 0.2 assists + 1.8 CS + 1.6 DC
   + 0.7 bonus + 0.8 appearance."

8. Be concrete with risk: if p_appear < 0.8 or availability_note is set,
   say so and suggest an alternative.

9. When the user shares a **public web link** (article, club news, etc.) and
   you need the page text to answer, call **fetch_public_page** with the URL.
   It returns a plain-text excerpt only (HTML stripped, size-capped). Do not
   use it for secrets or authenticated pages. **X/Twitter, Instagram, and
   similar sites** often return empty or login-wall HTML — if the tool text
   is useless, say you cannot read that page and ask the user to paste the
   relevant quote instead. Never invent article content not present in the
   tool output.

Formatting:
- Prefer short bullets with inline numbers.
- Cite the xP decomposition when recommending a pick.
- Units: prices in £m, FDR 1 (easiest) to 5 (hardest).
- Never fabricate players. If a tool returns no data, tell the user.`;

/**
 * Gemini expects OpenAPI "Schema" with uppercase `type` values ("OBJECT",
 * "STRING", etc.). Our tools declare lowercase JSON Schema; this walks the
 * tree and normalizes.
 */
function toGeminiSchema(s: JsonSchema): Schema {
  const typeMap: Record<string, Schema["type"]> = {
    object: "OBJECT" as Schema["type"],
    string: "STRING" as Schema["type"],
    number: "NUMBER" as Schema["type"],
    integer: "INTEGER" as Schema["type"],
    boolean: "BOOLEAN" as Schema["type"],
    array: "ARRAY" as Schema["type"],
    null: "TYPE_UNSPECIFIED" as Schema["type"],
  };

  const out: Schema = {};
  if (s.type) out.type = typeMap[s.type];
  if (s.description) out.description = s.description;
  if (s.enum) out.enum = s.enum.map(String);
  if (s.items) out.items = toGeminiSchema(s.items);
  if (s.required) out.required = [...s.required];
  if (s.properties) {
    out.properties = {};
    for (const [k, v] of Object.entries(s.properties)) {
      out.properties[k] = toGeminiSchema(v);
    }
  }
  return out;
}

export function toolsToFunctionDeclarations(
  tools: ToolHandler[],
): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: toGeminiSchema(t.input_schema),
  }));
}

/** Turn Gemini / Google API failures into a short user-readable line (no raw JSON blobs). */
export function userFacingGeminiError(
  err: unknown,
  locale?: string | null,
): string {
  const zh = (locale ?? "").trim().toLowerCase() === "zh";

  let raw = err instanceof Error ? err.message : String(err);
  raw = raw.trim();

  try {
    const j = JSON.parse(raw) as {
      error?: { message?: string; code?: number; status?: string };
    };
    const inner = j?.error?.message;
    if (typeof inner === "string" && inner.length > 0) raw = inner;
  } catch {
    /* not JSON */
  }

  const low = raw.toLowerCase();
  const regionBlocked =
    low.includes("user location") ||
    low.includes("location is not supported") ||
    low.includes("not supported for the api use");

  if (regionBlocked) {
    if (zh) {
      return (
        "无法使用 Google Gemini：谷歌因**地区政策**拒绝了本次请求（通常取决于**服务器出口 IP**，而不是你的手机）。\n\n" +
        "**Cloudflare Workers：** 在 Cloudflare 控制台创建 **AI Gateway**（Google AI Studio），然后设置环境变量：\n" +
        "• `GEMINI_AI_GATEWAY_BASE_URL` = `https://gateway.ai.cloudflare.com/v1/<账户ID>/<网关名>/google-ai-studio`，或\n" +
        "• `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_GATEWAY_NAME`（代码会自动拼出上述 URL）。\n" +
        "可选：`GEMINI_AI_GATEWAY_TOKEN`（网关开启鉴权时）。\n\n" +
        "**Vercel：** 可为 `/api/chat` 固定美国区 `iad1`（仓库已设置 `preferredRegion`）。"
      );
    }
    return (
      "Gemini blocked this request under **Google's regional policy** (usually your **host's egress IP**, not your phone).\n\n" +
      "**If you use Cloudflare Workers:** create an **AI Gateway** (Google AI Studio provider), then set either:\n" +
      "• `GEMINI_AI_GATEWAY_BASE_URL` = `https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/<GATEWAY_NAME>/google-ai-studio`, or\n" +
      "• `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_GATEWAY_NAME` (the app builds that URL for you).\n" +
      "Optional: `GEMINI_AI_GATEWAY_TOKEN` if the gateway requires `cf-aig-authorization`.\n\n" +
      "**On Vercel:** `/api/chat` is pinned to `iad1` (US East) in code; redeploy if you still see this."
    );
  }

  const quota =
    low.includes("quota") ||
    low.includes("resource_exhausted") ||
    low.includes("exceeded your current quota") ||
    low.includes("rate limit") ||
    /\b429\b/.test(raw) ||
    /"code"\s*:\s*429/.test(raw);

  if (quota) {
    if (zh) {
      return (
        "已达到 Gemini 用量或频率上限。请稍后再试，或在 Google AI Studio（aistudio.google.com）开通计费/提升配额。"
      );
    }
    return (
      "AI quota reached (Gemini free tier is limited). Wait a few minutes, or enable billing / upgrade " +
      "in Google AI Studio (aistudio.google.com), then try again."
    );
  }

  if (raw.length > 240) {
    if (zh) {
      return "AI 请求失败。请检查 GEMINI_API_KEY 与 AI Studio 配额。";
    }
    return "AI request failed. Check GEMINI_API_KEY and AI Studio quota.";
  }

  return raw;
}
