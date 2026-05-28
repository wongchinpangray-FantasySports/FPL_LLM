import { getServerSupabase } from "@/lib/supabase";
import { getFifaAuthCookie } from "@/lib/wc/fifa-auth";
import {
  companionFifaFeedUrls,
  parseFifaPlayerFeed,
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

function mergeBootstraps(
  a: FifaBootstrap | null,
  b: FifaBootstrap | null,
): FifaBootstrap | null {
  if (!a && !b) return null;
  const teamById = new Map<number, FifaBootstrap["teams"][0]>();
  for (const t of [...(a?.teams ?? []), ...(b?.teams ?? [])]) {
    teamById.set(t.id, t);
  }
  const elById = new Map<number, FifaElement>();
  for (const e of [...(a?.elements ?? []), ...(b?.elements ?? [])]) {
    elById.set(e.id, e);
  }
  const merged = {
    teams: [...teamById.values()],
    elements: [...elById.values()],
  };
  return merged.elements.length > 0 ? merged : null;
}

export async function fetchFifaBootstrap(): Promise<{
  bootstrap: FifaBootstrap | null;
  fetchError?: string;
}> {
  const path = await resolveBootstrapPath();
  if (!path) return { bootstrap: null };

  const primaryUrl = resolveFetchUrl(path);
  const urls = companionFifaFeedUrls(primaryUrl);

  const cookie = await getFifaAuthCookie();
  let merged: FifaBootstrap | null = null;
  let lastStatus = 0;

  for (const url of urls) {
    let { data, status } = await fetchFifaJson(url, "");
    lastStatus = status;
    if (!data && cookie) {
      const retry = await fetchFifaJson(url, cookie);
      data = retry.data;
      lastStatus = retry.status;
    }
    if (!data) continue;
    merged = mergeBootstraps(merged, parseFifaPlayerFeed(data));
  }

  if (!merged?.elements.length) {
    return {
      bootstrap: null,
      fetchError: cookie
        ? `FIFA feed returned no players (HTTP ${lastStatus || "error"}). Check FIFA_FANTASY_BOOTSTRAP_PATH is the full players.json Request URL.`
        : `FIFA feed returned no players (HTTP ${lastStatus || "error"}). Add cookie in Supabase fpl_meta or FIFA_FANTASY_AUTH_COOKIE if required.`,
    };
  }

  return { bootstrap: merged };
}

export async function syncWcPlayersFromFifa(): Promise<{
  synced: number;
  skipped: boolean;
  reason?: string;
}> {
  const { bootstrap, fetchError } = await fetchFifaBootstrap();
  if (!bootstrap?.elements.length) {
    return {
      synced: 0,
      skipped: true,
      reason: isFifaFantasyConfigured()
        ? fetchError ??
          "FIFA fetch failed — use the full players.json URL from DevTools (not /api/bootstrap-static unless that is what Network shows)"
        : "Set FIFA_FANTASY_BOOTSTRAP_PATH or FIFA_FANTASY_GAME_ID to sync the official player pool",
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

  const { error } = await supa.from("wc_players").upsert(rows, {
    onConflict: "fifa_element_id",
  });
  if (error) throw new Error(error.message);

  if (rows.length >= FIFA_POOL_OK) {
    await supa.from("wc_players").delete().in("source", ["fpl", "seed"]);
  }

  return { synced: rows.length, skipped: false };
}
