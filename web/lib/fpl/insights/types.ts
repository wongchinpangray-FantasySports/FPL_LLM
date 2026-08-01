export type InsightsTier = "free" | "premium";

export type InsightsPhase = 0 | 1 | 2 | 3;

export type InsightsStatus = "live" | "soon";

export type InsightsPlan = "free" | "premium";

/** Hub section grouping for Insights layout. */
export type InsightGroup = "prep" | "squad" | "market" | "models" | "archive";

export type InsightDefinition = {
  id: string;
  href: string;
  tier: InsightsTier;
  phase: InsightsPhase;
  status: InsightsStatus;
  group: InsightGroup;
  /** Page heading — keep short; detail lives in descriptionKey. */
  titleKey: string;
  /** Compact sub-nav label; falls back to titleKey when omitted. */
  navTitleKey?: string;
  descriptionKey: string;
  badgeKey?: "badgeLive" | "badgeSoon" | "badgePremium" | "badgeFree";
};

export type InsightsMeta = {
  season: string;
  seasonLabel: string;
  currentGw: number | null;
  nextGw: number | null;
  submissionOpen: boolean;
  deadlineTime: string | null;
  updatedAt: string | null;
};
