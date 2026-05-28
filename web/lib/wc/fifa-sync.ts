import { getServerSupabase } from "@/lib/supabase";
import { getFifaAuthCookie } from "@/lib/wc/fifa-auth";
import {
  buildFifaBootstrap,
  parseFifaPlayersList,
  parseFifaSquadsTeams,
  squadsJsonUrl,
  type FifaBootstrap,
  type FifaElement,
} from "@/lib/wc/fifa-parse";
import { fifaTeamToWcCode } from "@/lib/wc/fifa-teams";

const FIFA_PROXY =
  process.env.FIFA_FANTASY_PROXY_BASE ?? "https://play.fifa.com/api";
const FIFA_BOOTSTRAP_PATH =
  process.env.FIFA_FANTASY_BOOTSTRAP_PATH ?? "";
const FIFA_GAME_ID = process.env.FIFA_FANTASY_GAME_ID ?? "";

/** Minimum players before we consider the FIFA pool incomplete. */
export const WC_MIN_PLAYER_POOL = 200;

/** Mapped FIFA elements required to prefer official pool over FPL fallback. */
export const FIFA_POOL_OK = 30;

const POSITION_BY_TYPE: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function isFifaFantasyConfigured(): boolean {
  return Boolean(
    FIFA_BOOTSTRAP_PATH.trim() || FIFA_GAME_ID.trim(),
  );
}

async function readBootstrapPathFromMeta(): Promise<string> {
  try {
    const supa = getServerSupabase();
    const { data } = await supa
      .from("fpl_meta")
      .select("value")
      .eq("key", "fifa_fantasy_bootstrap_path")
      .maybeSingle();
    return (data?.value as string)?.trim() ?? "";
  } catch {
    return "";
  }
}

async function resolveBootstrapPath(): Promise<string> {
  if (FIFA_BOOTSTRAP_PATH.trim()) return FIFA_BOOTSTRAP_PATH.trim();
  const fromMeta = await readBootstrapPathFromMeta();
  if (fromMeta) return fromMeta;
  const id = FIFA_GAME_ID.trim();
  if (!id) return "";
  return `games/${id}/bootstrap-static`;
}

function resolveFetchUrl(path: string): string {
  const p = path.replace(/^\//, "");
  if (path.startsWith("http")) return path;
  // play.fifa.com gamezone JSON (e.g. json/.../players.json) is not under /api/
  if (p.startsWith("json/")) return `https://play.fifa.com/${p}`;
  return `${FIFA_PROXY.replace(/\/$/, "")}/${p}`;
}

function mapPosition(el: FifaElement, bootstrap: FifaBootstrap): string {
  if (el.position_label) {
    const u = el.position_label.toUpperCase();
    if (u.includes("GK")) return "GKP";
    if (u.startsWith("D")) return "DEF";
    if (u.startsWith("M")) return "MID";
    if (u.startsWith("F")) return "FWD";
  }
  const fromType = POSITION_BY_TYPE[el.element_type ?? 0];
  return fromType ?? "MID";
}

async function fetchFifaJson(
  url: string,
  cookie: string,
): Promise<{ data: unknown | null; status: number }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Origin: "https://fantasy.fifa.com",
    Referer: "https://fantasy.fifa.com/",
  };
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return { data: null, status: res.status };
  try {
    return { data: await res.json(), status: res.status };
  } catch {
    return { data: null, status: res.status };
  }
}

export type FifaFetchDebug = {
  path_configured: string;
  urls_tried: { url: string; status: number; parsed_players: number }[];
  cookie_used: boolean;
};

export async function fetchFifaBootstrap(): Promise<{
  bootstrap: FifaBootstrap | null;
  fetchError?: string;
  debug?: FifaFetchDebug;
}> {
  const path = await resolveBootstrapPath();
  if (!path) return { bootstrap: null };

  const primaryUrl = resolveFetchUrl(path);
  const squadsUrl = squadsJsonUrl(primaryUrl);

  const cookie = await getFifaAuthCookie();
  let lastStatus = 0;
  const urls_tried: FifaFetchDebug["urls_tried"] = [];

  async function loadUrl(url: string): Promise<unknown | null> {
    let { data, status } = await fetchFifaJson(url, "");
    lastStatus = status;
    if (!data && cookie) {
      const retry = await fetchFifaJson(url, cookie);
      data = retry.data;
      lastStatus = retry.status;
    }
    return data;
  }

  let squadsRaw: unknown | null = null;
  if (squadsUrl) {
    squadsRaw = await loadUrl(squadsUrl);
    urls_tried.push({
      url: squadsUrl,
      status: lastStatus,
      parsed_players: parseFifaSquadsTeams(squadsRaw).length,
    });
  }

  const playersRaw = await loadUrl(primaryUrl);
  urls_tried.push({
    url: primaryUrl,
    status: lastStatus,
    parsed_players: parseFifaPlayersList(playersRaw).length,
  });

  const merged = buildFifaBootstrap(playersRaw, squadsRaw);

  const debug: FifaFetchDebug = {
    path_configured: path,
    urls_tried,
    cookie_used: Boolean(cookie),
  };

  if (!merged?.elements.length) {
    const hint =
      lastStatus === 401 || lastStatus === 403
        ? "HTTP 401/403 — add cookie via Supabase fpl_meta key fifa_fantasy_auth_cookie"
        : lastStatus === 404
          ? "HTTP 404 — paste the full players.json Request URL from DevTools"
          : "use the full https://play.fifa.com/json/.../players.json URL";
    return {
      bootstrap: null,
      fetchError: `FIFA feed returned no players (last HTTP ${lastStatus || "error"}). ${hint}.`,
      debug,
    };
  }

  return { bootstrap: merged, debug };
}

export async function syncWcPlayersFromFifa(): Promise<{
  synced: number;
  skipped: boolean;
  reason?: string;
  debug?: FifaFetchDebug;
}> {
  const { bootstrap, fetchError, debug } = await fetchFifaBootstrap();
  if (!bootstrap?.elements.length) {
    return {
      synced: 0,
      skipped: true,
      reason: isFifaFantasyConfigured()
        ? fetchError ??
          "FIFA fetch failed — use the full players.json URL from DevTools"
        : "Set FIFA_FANTASY_BOOTSTRAP_PATH or FIFA_FANTASY_GAME_ID to sync the official player pool",
      debug,
    };
  }

  const supa = getServerSupabase();
  const { data: wcTeams, error: tErr } = await supa
    .from("wc_teams")
    .select("id,code");
  if (tErr) throw new Error(tErr.message);

  const wcTeamByCode = new Map(
    (wcTeams ?? []).map((t) => [t.code as string, t.id as number]),
  );
  const fifaTeamToWc = new Map<number, string>();
  let unmappedTeams = 0;
  for (const t of bootstrap.teams) {
    const code = fifaTeamToWcCode(t);
    if (code) fifaTeamToWc.set(t.id, code);
    else unmappedTeams++;
  }

  const rows = bootstrap.elements
    .map((el) => {
      let wcCode = el.team_code ?? null;
      if (!wcCode && el.team != null) {
        wcCode = fifaTeamToWc.get(el.team) ?? null;
      }
      if (!wcCode) return null;
      const wc_team_id = wcTeamByCode.get(wcCode);
      if (wc_team_id == null) return null;

      const name =
        el.web_name?.trim() ||
        `${el.first_name ?? ""} ${el.second_name ?? ""}`.trim();
      if (!name) return null;

      return {
        wc_team_id,
        name,
        fpl_id: null,
        fifa_element_id: el.id,
        position: mapPosition(el, bootstrap),
        price: num(el.now_cost, 0) / 10 || 5.0,
        goals: num(el.goals_scored),
        assists: num(el.assists),
        xg: num(el.expected_goals),
        xa: num(el.expected_assists),
        form: num(el.form),
        minutes: num(el.minutes),
        source: "fifa",
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return {
      synced: 0,
      skipped: true,
      reason: `No FIFA players mapped to WC teams (${unmappedTeams} FIFA teams unmapped, ${bootstrap.elements.length} raw players)`,
    };
  }

  const deduped = [
    ...new Map(
      rows.map((r) => [r!.fifa_element_id as number, r!]),
    ).values(),
  ];

  await supa.from("wc_players").delete().eq("source", "fifa");

  const BATCH = 200;
  for (let i = 0; i < deduped.length; i += BATCH) {
    const chunk = deduped.slice(i, i + BATCH);
    const { error } = await supa.from("wc_players").insert(chunk);
    if (error) throw new Error(`Insert batch ${i}: ${error.message}`);
  }

  if (deduped.length >= FIFA_POOL_OK) {
    await supa.from("wc_players").delete().in("source", ["fpl", "seed"]);
  }

  return { synced: deduped.length, skipped: false };
}
