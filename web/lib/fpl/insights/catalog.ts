import type { InsightDefinition } from "@/lib/fpl/insights/types";

/** Central registry for all insight pages — tiers, routes, rollout phase. */
export const INSIGHT_CATALOG: InsightDefinition[] = [
  {
    id: "preseason-signals",
    href: "/fpl/insights/preseason-signals",
    tier: "free",
    phase: 0,
    status: "live",
    titleKey: "preseasonSignals.title",
    descriptionKey: "preseasonSignals.description",
    badgeKey: "badgeLive",
  },
  {
    id: "set-pieces",
    href: "/fpl/insights/set-pieces",
    tier: "free",
    phase: 1,
    status: "soon",
    titleKey: "setPieces.title",
    descriptionKey: "setPieces.description",
    badgeKey: "badgeSoon",
  },
  {
    id: "defcon",
    href: "/fpl/insights/defcon",
    tier: "free",
    phase: 1,
    status: "soon",
    titleKey: "defcon.title",
    descriptionKey: "defcon.description",
    badgeKey: "badgeSoon",
  },
  {
    id: "transfers",
    href: "/fpl/insights/transfers",
    tier: "premium",
    phase: 1,
    status: "soon",
    titleKey: "transfers.title",
    descriptionKey: "transfers.description",
    badgeKey: "badgePremium",
  },
  {
    id: "differentials",
    href: "/fpl/insights/differentials",
    tier: "premium",
    phase: 1,
    status: "soon",
    titleKey: "differentials.title",
    descriptionKey: "differentials.description",
    badgeKey: "badgePremium",
  },
  {
    id: "fixture-swing",
    href: "/fpl/insights/fixture-swing",
    tier: "free",
    phase: 2,
    status: "soon",
    titleKey: "fixtureSwing.title",
    descriptionKey: "fixtureSwing.description",
    badgeKey: "badgeSoon",
  },
  {
    id: "xg-divergence",
    href: "/fpl/insights/xg-divergence",
    tier: "premium",
    phase: 2,
    status: "soon",
    titleKey: "xgDivergence.title",
    descriptionKey: "xgDivergence.description",
    badgeKey: "badgePremium",
  },
  {
    id: "price-changes",
    href: "/fpl/insights/price-changes",
    tier: "premium",
    phase: 2,
    status: "soon",
    titleKey: "priceChanges.title",
    descriptionKey: "priceChanges.description",
    badgeKey: "badgePremium",
  },
  {
    id: "historical",
    href: "/fpl/historical",
    tier: "free",
    phase: 1,
    status: "live",
    titleKey: "historical.title",
    descriptionKey: "historical.description",
    badgeKey: "badgeFree",
  },
  {
    id: "xp-accuracy",
    href: "/fpl/insights/xp-accuracy",
    tier: "premium",
    phase: 3,
    status: "soon",
    titleKey: "xpAccuracy.title",
    descriptionKey: "xpAccuracy.description",
    badgeKey: "badgePremium",
  },
];

export const DEFAULT_DIFFERENTIALS_MAX_OWNERSHIP = 5;

export function getInsightById(id: string): InsightDefinition | undefined {
  return INSIGHT_CATALOG.find((entry) => entry.id === id);
}

export function listLiveInsights(): InsightDefinition[] {
  return INSIGHT_CATALOG.filter((entry) => entry.status === "live");
}

export function listPremiumInsightIds(): string[] {
  return INSIGHT_CATALOG.filter((entry) => entry.tier === "premium").map(
    (entry) => entry.id,
  );
}
