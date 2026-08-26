import { stripLocalePrefix } from "@/i18n/routing";
import { SITE_FEATURES, type SiteFeature } from "@/lib/analytics/types";

const FEATURE_PREFIXES: Array<[string, SiteFeature]> = [
  ["/fpl/insights/recommended-squad", "recommended_squad"],
  ["/fpl/insights/price-forecast", "price_forecast"],
  ["/fpl/insights/price-changes", "price_changes"],
  ["/fpl/insights/best-of-position", "best_of_position"],
  ["/fpl/insights/transfers", "transfers"],
  ["/fpl/insights/set-pieces", "set_pieces"],
  ["/fpl/insights/defcon", "defcon"],
  ["/fpl/insights/differentials", "differentials"],
  ["/fpl/insights/fixture-swing", "fixture_swing"],
  ["/fpl/insights/preseason-signals", "preseason_signals"],
  ["/fpl/insights/value", "value"],
  ["/fpl/insights/xp-accuracy", "xp_accuracy"],
  ["/fpl/insights/xg-divergence", "xg_divergence"],
  ["/fpl/insights/xa-divergence", "xa_divergence"],
  ["/fpl/insights", "insights"],
  ["/fpl/mini-league", "mini_league"],
  ["/fpl/fixtures", "fixtures"],
  ["/fpl/preseason", "preseason"],
  ["/fpl/historical", "historical"],
  ["/fpl/guide", "guide"],
  ["/news/fpl-daily", "fpl_daily"],
  ["/news/fpl-x", "fpl_briefing"],
  ["/play/wc-mini", "wc_mini"],
  ["/play/mini", "mini_game"],
  ["/squad-builder", "squad_builder"],
  ["/onboarding", "onboarding"],
  ["/dashboard", "dashboard"],
  ["/worldcup", "worldcup"],
  ["/manager", "manager"],
  ["/players", "players"],
  ["/planner", "planner"],
  ["/account", "account"],
  ["/player", "player"],
  ["/scout", "scout"],
  ["/inbox", "inbox"],
  ["/news", "news"],
  ["/chat", "chat"],
  ["/play", "play"],
  ["/auth", "auth"],
  ["/docs", "docs"],
  ["/fpl", "fpl_hub"],
];

export function normalizeTrackedPath(raw: string): string | null {
  let path = raw.trim();
  if (!path) return null;
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      path = new URL(path).pathname;
    }
  } catch {
    return null;
  }
  const q = path.indexOf("?");
  if (q >= 0) path = path.slice(0, q);
  const hash = path.indexOf("#");
  if (hash >= 0) path = path.slice(0, hash);
  path = stripLocalePrefix(path);
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 300) path = path.slice(0, 300);
  return path;
}

export function shouldSkipTracking(path: string): boolean {
  const p = stripLocalePrefix(path);
  if (p === "/admin" || p.startsWith("/admin/")) return true;
  if (p.startsWith("/api/")) return true;
  return false;
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function featureFromPath(rawPath: string): SiteFeature {
  const path = normalizeTrackedPath(rawPath);
  if (!path) return "other";
  if (path === "/") return "home";
  if (path === "/s" || path.startsWith("/s/")) return "share";
  for (const [prefix, feature] of FEATURE_PREFIXES) {
    if (matchesPrefix(path, prefix)) return feature;
  }
  return "other";
}

export function isSiteFeature(value: string): value is SiteFeature {
  return (SITE_FEATURES as readonly string[]).includes(value);
}
