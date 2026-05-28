import { getServerSupabase } from "@/lib/supabase";
import { getFifaAuthCookie } from "@/lib/wc/fifa-auth";
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

type FifaElement = {
  id: number;
  web_name?: string;
  first_name?: string;
  second_name?: string;
  team?: number;
  element_type?: number;
  now_cost?: number;
  form?: string | number;
  goals_scored?: number;
  assists?: number;
  expected_goals?: string | number;
  expected_assists?: string | number;
  minutes?: number;
};

type FifaBootstrap = {
  elements?: FifaElement[];
  teams?: { id: number; code?: number | string; name?: string; short_name?: string }[];
  element_types?: { id: number; singular_name_short?: string }[];
};

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

function resolveBootstrapPath(): string {
  if (FIFA_BOOTSTRAP_PATH.trim()) return FIFA_BOOTSTRAP_PATH.trim();
  const id = FIFA_GAME_ID.trim();
  if (!id) return "";
  return `games/${id}/bootstrap-static`;
}

function mapPosition(el: FifaElement, bootstrap: FifaBootstrap): string {
  const fromType = POSITION_BY_TYPE[el.element_type ?? 0];
  if (fromType) return fromType;
  const label = bootstrap.element_types?.find((et) => et.id === el.element_type)
    ?.singular_name_short;
  if (!label) return "MID";
  const u = label.toUpperCase();
  if (u.startsWith("GK")) return "GKP";
  if (u.startsWith("D")) return "DEF";
  if (u.startsWith("M")) return "MID";
  if (u.startsWith("F")) return "FWD";
  return "MID";
}

async function fetchFifaJson(url: string, cookie: string): Promise<unknown | null> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Origin: "https://fantasy.fifa.com",
    Referer: "https://fantasy.fifa.com/",
  };
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchFifaBootstrap(): Promise<FifaBootstrap | null> {
  const path = resolveBootstrapPath();
  if (!path) return null;

  const url = path.startsWith("http")
    ? path
    : `${FIFA_PROXY.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

  let raw = await fetchFifaJson(url, "");
  if (!raw) {
    const cookie = await getFifaAuthCookie();
    if (cookie) raw = await fetchFifaJson(url, cookie);
  }
  if (!raw) return null;

  const data = raw as FifaBootstrap | { data?: FifaBootstrap };
  if ("data" in data && data.data) return data.data;
  return data as FifaBootstrap;
}

export async function syncWcPlayersFromFifa(): Promise<{
  synced: number;
  skipped: boolean;
  reason?: string;
}> {
  const bootstrap = await fetchFifaBootstrap();
  if (!bootstrap?.elements?.length) {
    return {
      synced: 0,
      skipped: true,
      reason: isFifaFantasyConfigured()
        ? "FIFA bootstrap fetch failed or returned no elements — check path/cookie on Vercel"
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
  for (const t of bootstrap.teams ?? []) {
    const code = fifaTeamToWcCode(t);
    if (code) fifaTeamToWc.set(t.id, code);
    else unmappedTeams++;
  }

  const rows = bootstrap.elements
    .map((el) => {
      const wcCode = fifaTeamToWc.get(el.team ?? -1);
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
      reason: `No FIFA elements mapped to WC teams (${unmappedTeams} FIFA teams unmapped)`,
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
