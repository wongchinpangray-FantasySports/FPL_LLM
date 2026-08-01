export type InsightsTier = "free" | "premium";

export type InsightsPhase = 0 | 1 | 2 | 3;

export type InsightsStatus = "live" | "soon";

export type InsightsPlan = "free" | "premium";

export type InsightDefinition = {
  id: string;
  href: string;
  tier: InsightsTier;
  phase: InsightsPhase;
  status: InsightsStatus;
  /** i18n keys under fplInsights.catalog.{id} */
  titleKey: string;
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
