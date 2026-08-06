import type { InsightDefinition, InsightGroup } from "@/lib/fpl/insights/types";

/** Central registry for all insight pages — tiers, routes, rollout phase. */
export const INSIGHT_CATALOG: InsightDefinition[] = [
  {
    id: "preseason-signals",
    href: "/fpl/insights/preseason-signals",
    tier: "free",
    phase: 0,
    status: "live",
    group: "prep",
    titleKey: "preseasonSignals.title",
    navTitleKey: "nav.preseason",
    descriptionKey: "preseasonSignals.description",
    badgeKey: "badgeLive",
  },
  {
    id: "best-of-position",
    href: "/fpl/insights/best-of-position",
    tier: "free",
    phase: 0,
    status: "live",
    group: "prep",
    titleKey: "bestOfPosition.title",
    navTitleKey: "nav.bestOfPosition",
    descriptionKey: "bestOfPosition.description",
    badgeKey: "badgeLive",
  },
  {
    id: "set-pieces",
    href: "/fpl/insights/set-pieces",
    tier: "free",
    phase: 1,
    status: "live",
    group: "squad",
    titleKey: "setPieces.title",
    navTitleKey: "nav.setPieces",
    descriptionKey: "setPieces.description",
    badgeKey: "badgeLive",
  },
  {
    id: "defcon",
    href: "/fpl/insights/defcon",
    tier: "free",
    phase: 1,
    status: "live",
    group: "squad",
    titleKey: "defcon.title",
    navTitleKey: "nav.defcon",
    descriptionKey: "defcon.description",
    badgeKey: "badgeLive",
  },
  {
    id: "fixture-swing",
    href: "/fpl/insights/fixture-swing",
    tier: "free",
    phase: 2,
    status: "live",
    group: "squad",
    titleKey: "fixtureSwing.title",
    navTitleKey: "nav.fixtures",
    descriptionKey: "fixtureSwing.description",
    badgeKey: "badgeLive",
  },
  {
    id: "transfers",
    href: "/fpl/insights/transfers",
    tier: "premium",
    phase: 1,
    status: "live",
    group: "market",
    titleKey: "transfers.title",
    navTitleKey: "nav.transfers",
    descriptionKey: "transfers.description",
    badgeKey: "badgePremium",
  },
  {
    id: "differentials",
    href: "/fpl/insights/differentials",
    tier: "premium",
    phase: 1,
    status: "live",
    group: "market",
    titleKey: "differentials.title",
    navTitleKey: "nav.differentials",
    descriptionKey: "differentials.description",
    badgeKey: "badgePremium",
  },
  {
    id: "price-changes",
    href: "/fpl/insights/price-changes",
    tier: "premium",
    phase: 2,
    status: "live",
    group: "market",
    titleKey: "priceChanges.title",
    navTitleKey: "nav.prices",
    descriptionKey: "priceChanges.description",
    badgeKey: "badgePremium",
  },
  {
    id: "xg-divergence",
    href: "/fpl/insights/xg-divergence",
    tier: "premium",
    phase: 2,
    status: "live",
    group: "models",
    titleKey: "xgDivergence.title",
    navTitleKey: "nav.xg",
    descriptionKey: "xgDivergence.description",
    badgeKey: "badgePremium",
  },
  {
    id: "xa-divergence",
    href: "/fpl/insights/xa-divergence",
    tier: "premium",
    phase: 2,
    status: "live",
    group: "models",
    titleKey: "xaDivergence.title",
    navTitleKey: "nav.xa",
    descriptionKey: "xaDivergence.description",
    badgeKey: "badgePremium",
  },
  {
    id: "xp-accuracy",
    href: "/fpl/insights/xp-accuracy",
    tier: "premium",
    phase: 3,
    status: "live",
    group: "models",
    titleKey: "xpAccuracy.title",
    navTitleKey: "nav.xp",
    descriptionKey: "xpAccuracy.description",
    badgeKey: "badgePremium",
  },
  {
    id: "historical",
    href: "/fpl/historical",
    tier: "free",
    phase: 1,
    status: "live",
    group: "archive",
    titleKey: "historical.title",
    navTitleKey: "nav.historical",
    descriptionKey: "historical.description",
    badgeKey: "badgeFree",
  },
];

export const INSIGHT_GROUP_ORDER: {
  id: InsightGroup;
  labelKey: string;
}[] = [
  { id: "prep", labelKey: "groupPrep" },
  { id: "squad", labelKey: "groupSquad" },
  { id: "market", labelKey: "groupMarket" },
  { id: "models", labelKey: "groupModels" },
  { id: "archive", labelKey: "groupArchive" },
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

export function insightsByGroup(
  entries: InsightDefinition[] = INSIGHT_CATALOG,
): Map<InsightGroup, InsightDefinition[]> {
  const map = new Map<InsightGroup, InsightDefinition[]>();
  for (const group of INSIGHT_GROUP_ORDER) {
    map.set(group.id, []);
  }
  for (const entry of entries) {
    if (entry.status !== "live") continue;
    const list = map.get(entry.group) ?? [];
    list.push(entry);
    map.set(entry.group, list);
  }
  return map;
}

export function insightNavLabelKey(entry: InsightDefinition): string {
  return entry.navTitleKey ?? entry.titleKey;
}
