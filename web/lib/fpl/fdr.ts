import {
  buildH2HStore,
  projectH2HAttackEase,
  type H2HStore,
} from "@/lib/fpl/h2h";

/**
 * Map expected goals-for to FDR 1–5 using fixed PL-calibrated bands.
 * 1 = easiest attack fixture, 5 = hardest (not season quintiles).
 */
export function easeToFdr(ease: number): number {
  if (ease >= 1.72) return 1;
  if (ease >= 1.48) return 2;
  if (ease >= 1.28) return 3;
  if (ease >= 1.06) return 4;
  return 5;
}

export function buildFplFdrLookup(
  fixtures: {
    id: number;
    home: string;
    away: string;
  }[],
  store: H2HStore,
): Map<string, number> {
  const out = new Map<string, number>();

  for (const fx of fixtures) {
    const homeEase = projectH2HAttackEase(fx.home, fx.away, true, store);
    const awayEase = projectH2HAttackEase(fx.away, fx.home, false, store);
    out.set(`${fx.home}:${fx.id}`, easeToFdr(homeEase));
    out.set(`${fx.away}:${fx.id}`, easeToFdr(awayEase));
  }

  return out;
}

export function lookupFplFdr(
  lookup: Map<string, number>,
  teamCode: string,
  fixtureId: number,
  fallback = 3,
): number {
  return lookup.get(`${teamCode}:${fixtureId}`) ?? fallback;
}

export function fdrClass(fdr: number | null): string {
  if (fdr === null) return "bg-muted";
  if (fdr <= 2) return "bg-emerald-500/30 border-emerald-400/40";
  if (fdr === 3) return "bg-amber-500/25 border-amber-400/40";
  if (fdr === 4) return "bg-orange-500/30 border-orange-400/40";
  return "bg-rose-600/40 border-rose-400/50";
}

export { buildH2HStore };
