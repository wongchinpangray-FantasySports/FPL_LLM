import { getServerSupabase } from "@/lib/supabase";
import { getInsightById, listPremiumInsightIds } from "@/lib/fpl/insights/catalog";
import type { InsightsPlan } from "@/lib/fpl/insights/types";

/** When false (default), premium insights are visible to everyone until billing launches. */
export function isInsightsPremiumEnforced(): boolean {
  return process.env.INSIGHTS_PREMIUM_ENFORCE === "true";
}

export function getInsightsSponsor(): { name: string; href: string } | null {
  const name = process.env.INSIGHTS_SPONSOR_NAME?.trim();
  const href = process.env.INSIGHTS_SPONSOR_URL?.trim();
  if (!name || !href) return null;
  return { name, href };
}

export async function getUserInsightsPlan(
  userId: string | null | undefined,
): Promise<InsightsPlan> {
  if (!userId) return "free";
  try {
    const supa = getServerSupabase();
    const { data } = await supa
      .from("profiles")
      .select("insights_plan,insights_plan_expires_at")
      .eq("id", userId)
      .maybeSingle();

    const plan = data?.insights_plan === "premium" ? "premium" : "free";
    if (plan !== "premium") return "free";

    const expires = data?.insights_plan_expires_at;
    if (expires && Date.parse(String(expires)) < Date.now()) return "free";
    return "premium";
  } catch {
    return "free";
  }
}

export async function canAccessInsight(
  insightId: string,
  userId?: string | null,
): Promise<boolean> {
  const entry = getInsightById(insightId);
  if (!entry) return false;
  if (entry.tier === "free") return true;
  if (!isInsightsPremiumEnforced()) return true;
  const plan = await getUserInsightsPlan(userId ?? null);
  return plan === "premium";
}

export async function getInsightsAccessSummary(userId?: string | null): Promise<{
  enforcePremium: boolean;
  plan: InsightsPlan;
  premiumInsightIds: string[];
  lockedInsightIds: string[];
}> {
  const enforcePremium = isInsightsPremiumEnforced();
  const plan = await getUserInsightsPlan(userId ?? null);
  const premiumInsightIds = listPremiumInsightIds();
  const lockedInsightIds =
    enforcePremium && plan !== "premium" ? premiumInsightIds : [];
  return { enforcePremium, plan, premiumInsightIds, lockedInsightIds };
}

/** Same Insights Pro plan; used by standalone premium tools (e.g. Mini League Killer). */
export async function canAccessPremiumFeature(
  userId?: string | null,
): Promise<boolean> {
  if (!isInsightsPremiumEnforced()) return true;
  const plan = await getUserInsightsPlan(userId ?? null);
  return plan === "premium";
}
