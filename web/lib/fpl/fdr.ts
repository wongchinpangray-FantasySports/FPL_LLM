import {
  buildH2HStore,
  projectH2HAttackEase,
  type H2HStore,
} from "@/lib/fpl/h2h";
import {
  loadTeamStrengthByCode,
  type TeamFplStrength,
} from "@/lib/fpl/strength";

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
  strengths: Map<string, TeamFplStrength>,
): Map<string, number> {
  const out = new Map<string, number>();

  for (const fx of fixtures) {
    const homeEase = projectH2HAttackEase(
      fx.home,
      fx.away,
      true,
      store,
      strengths,
    );
    const awayEase = projectH2HAttackEase(
      fx.away,
      fx.home,
      false,
      store,
      strengths,
    );
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

export type FplFdrLevel = 1 | 2 | 3 | 4 | 5;

export const FPL_FDR_LEVELS: FplFdrLevel[] = [1, 2, 3, 4, 5];

/** Clamp and round to official FPL FDR 1 (easiest) – 5 (hardest). */
export function normalizeFplFdr(
  fdr: number | null | undefined,
): FplFdrLevel | null {
  if (fdr == null || !Number.isFinite(fdr)) return null;
  return Math.min(5, Math.max(1, Math.round(fdr))) as FplFdrLevel;
}

/**
 * Official-style FDR chip colours — one distinct band per level (1 = easiest).
 * Tuned for dark UI; mirrors the FPL green → grey → red fixture ticker.
 */
export function fdrClass(fdr: number | null): string {
  const level = normalizeFplFdr(fdr);
  if (level == null) {
    return "border border-border bg-muted text-muted-foreground";
  }

  switch (level) {
    case 1:
      return "border border-emerald-700/55 bg-emerald-950/80 text-emerald-100";
    case 2:
      return "border border-emerald-500/50 bg-emerald-700/55 text-emerald-50";
    case 3:
      return "border border-slate-400/45 bg-slate-600/35 text-slate-100";
    case 4:
      return "border border-orange-500/55 bg-orange-700/50 text-orange-50";
    case 5:
      return "border border-red-700/60 bg-red-950/75 text-red-100";
    default:
      return "border border-border bg-muted text-muted-foreground";
  }
}

export { buildH2HStore, loadTeamStrengthByCode };
