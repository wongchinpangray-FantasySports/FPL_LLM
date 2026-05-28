import { getServerSupabase } from "@/lib/supabase";
import { WC_GROUP_TEAMS } from "@/lib/wc/seed-data";

const FIFA_PROXY =
  process.env.FIFA_FANTASY_PROXY_BASE ?? "https://play.fifa.com/api";
const FIFA_BOOTSTRAP_PATH =
  process.env.FIFA_FANTASY_BOOTSTRAP_PATH ?? "";
const FIFA_AUTH_COOKIE = process.env.FIFA_FANTASY_AUTH_COOKIE ?? "";

/** Minimum players before we consider the FIFA pool incomplete. */
export const WC_MIN_PLAYER_POOL = 200;

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

const FIFA_TEAM_CODE_MAP: Record<string, string> = Object.fromEntries(
  WC_GROUP_TEAMS.map((t) => [t.code, t.code]),
);

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTeamCode(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (FIFA_TEAM_CODE_MAP[s]) return FIFA_TEAM_CODE_MAP[s];
  return null;
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

export async function fetchFifaBootstrap(): Promise<FifaBootstrap | null> {
  if (!FIFA_BOOTSTRAP_PATH) return null;

  const url = FIFA_BOOTSTRAP_PATH.startsWith("http")
    ? FIFA_BOOTSTRAP_PATH
    : `${FIFA_PROXY.replace(/\/$/, "")}/${FIFA_BOOTSTRAP_PATH.replace(/^\//, "")}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    Origin: "https://fantasy.fifa.com",
    Referer: "https://fantasy.fifa.com/",
  };
  if (FIFA_AUTH_COOKIE) headers.Cookie = FIFA_AUTH_COOKIE;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as FifaBootstrap | { data?: FifaBootstrap };
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
      reason: FIFA_BOOTSTRAP_PATH
        ? "FIFA bootstrap fetch failed or returned no elements"
        : "Set FIFA_FANTASY_BOOTSTRAP_PATH to sync the official player pool",
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
  for (const t of bootstrap.teams ?? []) {
    const code = normalizeTeamCode(t.short_name ?? t.code ?? t.name);
    if (code) fifaTeamToWc.set(t.id, code);
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
    return { synced: 0, skipped: true, reason: "No FIFA elements mapped to WC teams" };
  }

  const { error } = await supa.from("wc_players").upsert(rows, {
    onConflict: "fifa_element_id",
  });
  if (error) throw new Error(error.message);

  return { synced: rows.length, skipped: false };
}
