import { getServerSupabase } from "@/lib/supabase";
import { withIsolateCache } from "@/lib/worker-isolate-cache";

export type PreseasonFplPlayerIndex = {
  resolveFplId: (scorerName: string, plCode: string) => number | null;
};

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : name;
}

type FplRow = {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
};

export async function loadPreseasonFplPlayerIndex(): Promise<PreseasonFplPlayerIndex> {
  return withIsolateCache("preseason-fpl-player-index", 300_000, () =>
    loadPreseasonFplPlayerIndexUncached(),
  );
}

async function loadPreseasonFplPlayerIndexUncached(): Promise<PreseasonFplPlayerIndex> {
  const empty: PreseasonFplPlayerIndex = {
    resolveFplId: () => null,
  };

  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from("players_static")
      .select("fpl_id,web_name,name,team");
    if (error || !data?.length) return empty;

    const byTeamNorm = new Map<string, Map<string, FplRow>>();
    const byTeamLast = new Map<string, Map<string, FplRow[]>>();

    for (const row of data as FplRow[]) {
      const team = (row.team ?? "").toUpperCase();
      if (!team) continue;
      const labels = [row.web_name, row.name].filter(Boolean) as string[];
      for (const label of labels) {
        const norm = normName(label);
        if (!norm) continue;
        if (!byTeamNorm.has(team)) byTeamNorm.set(team, new Map());
        byTeamNorm.get(team)!.set(norm, row);

        const ln = normName(lastName(label));
        if (!ln) continue;
        if (!byTeamLast.has(team)) byTeamLast.set(team, new Map());
        const lastMap = byTeamLast.get(team)!;
        const list = lastMap.get(ln) ?? [];
        if (!list.some((p) => p.fpl_id === row.fpl_id)) list.push(row);
        lastMap.set(ln, list);
      }
    }

    return {
      resolveFplId(scorerName: string, plCode: string) {
        const team = plCode.toUpperCase();
        const normMap = byTeamNorm.get(team);
        const lastMap = byTeamLast.get(team);
        if (!normMap || !lastMap) return null;

        const norm = normName(scorerName);
        const direct = normMap.get(norm);
        if (direct) return direct.fpl_id;

        const ln = normName(lastName(scorerName));
        const hits = lastMap.get(ln);
        if (!hits || hits.length !== 1) return null;
        return hits[0]!.fpl_id;
      },
    };
  } catch {
    return empty;
  }
}
