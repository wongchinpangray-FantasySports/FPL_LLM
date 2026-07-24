import { unstable_cache } from "next/cache";
import { fplGet } from "@/lib/fpl";

const POSITION_BY_TYPE: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

type BootstrapPayload = {
  elements?: Array<{
    id: number;
    code?: number;
    first_name?: string;
    second_name?: string;
    web_name?: string;
    team: number;
    element_type?: number;
    now_cost?: number;
    status?: string;
    form?: string;
    total_points?: number;
    minutes?: number;
    selected_by_percent?: string;
    points_per_game?: string;
  }>;
  teams?: Array<{
    id: number;
    name: string;
    short_name: string;
  }>;
};

export type FplLiveBrowsePlayer = {
  fpl_id: number;
  code: number | null;
  web_name: string | null;
  name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
  total_points: number | null;
  last_season_points: number | null;
  selected_by_percent: number | null;
  form: number | null;
};

export type SquadBuilderPlayerSort =
  | "price"
  | "points"
  | "ownership"
  | "form";

function num(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

async function fetchOfficialFplPlayers(): Promise<FplLiveBrowsePlayer[]> {
  const raw = await fplGet<BootstrapPayload>("/bootstrap-static/", {
    cacheBust: true,
  });
  const teamsById = new Map(
    (raw.teams ?? []).map((t) => [t.id, t.name] as const),
  );

  return (raw.elements ?? []).map((el) => {
    const price = num(el.now_cost);
    return {
      fpl_id: el.id,
      code: num(el.code),
      web_name: el.web_name ?? null,
      name: `${el.first_name ?? ""} ${el.second_name ?? ""}`.trim() || null,
      team: teamsById.get(el.team) ?? null,
      team_id: el.team ?? null,
      position: POSITION_BY_TYPE[el.element_type ?? 0] ?? null,
      base_price: price != null ? Math.round((price / 10) * 10) / 10 : null,
      total_points: num(el.total_points),
      last_season_points: null,
      selected_by_percent: num(el.selected_by_percent),
      form: num(el.form),
    };
  });
}

/** Official FPL bootstrap-static player pool (revalidated every 2 minutes). */
export const getOfficialFplBrowsePlayers = unstable_cache(
  fetchOfficialFplPlayers,
  ["squad-builder-official-fpl-players"],
  { revalidate: 120 },
);

function tokenizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function matchesSearch(p: FplLiveBrowsePlayer, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const hay = `${p.web_name ?? ""} ${p.name ?? ""} ${p.team ?? ""}`.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

export function filterOfficialFplPlayers(
  players: FplLiveBrowsePlayer[],
  opts: {
    q?: string;
    position?: string;
    teamId?: number;
    sort?: SquadBuilderPlayerSort;
    limit?: number;
  },
): FplLiveBrowsePlayer[] {
  const tokens = tokenizeQuery(opts.q ?? "");
  let rows = players.filter((p) => {
    if (tokens.length > 0 && !matchesSearch(p, tokens)) return false;
    if (opts.position && p.position !== opts.position) return false;
    if (opts.teamId != null && p.team_id !== opts.teamId) return false;
    return true;
  });

  const sort = opts.sort ?? "price";
  rows = [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "points":
        cmp = (b.total_points ?? -1) - (a.total_points ?? -1);
        break;
      case "ownership":
        cmp =
          (b.selected_by_percent ?? -1) - (a.selected_by_percent ?? -1);
        break;
      case "form":
        cmp = (b.form ?? -1) - (a.form ?? -1);
        break;
      case "price":
      default:
        cmp = (b.base_price ?? -1) - (a.base_price ?? -1);
        break;
    }
    if (cmp !== 0) return cmp;
    return (a.web_name ?? a.name ?? "").localeCompare(
      b.web_name ?? b.name ?? "",
      undefined,
      { sensitivity: "base" },
    );
  });

  const limit = opts.limit ?? 80;
  return rows.slice(0, limit);
}
