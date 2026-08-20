import type { ScoutEventType, ScoutGoTarget } from "@/lib/scout/types";

export const FFS_SITE_URL = "https://www.fantasyfootballscout.co.uk";
export const FFS_RSS_URL = "https://www.fantasyfootballscout.co.uk/feed/";
export const FFS_PREMIUM_QR_PATH = "/scout/ffs-premium-qr.png";

export function ffsPremiumUrl(): string {
  return (
    process.env.FFS_PREMIUM_URL?.trim() ||
    `${FFS_SITE_URL}/register`
  );
}

export function ffsTeamRaterUrl(): string {
  return (
    process.env.FFS_TEAM_RATER_URL?.trim() ||
    `${FFS_SITE_URL}/how-to-use-our-rate-my-team-tool-to-get-your-fpl-squad-rated`
  );
}

export function scoutGoHref(
  target: ScoutGoTarget,
  opts?: { slug?: string; articleId?: string },
): string {
  const q = new URLSearchParams();
  if (opts?.slug) q.set("article", opts.slug);
  if (opts?.articleId) q.set("id", opts.articleId);
  const qs = q.toString();
  return `/api/scout/go/${target}${qs ? `?${qs}` : ""}`;
}

export function eventTypeForGoTarget(target: ScoutGoTarget): ScoutEventType {
  if (target === "premium") return "click_premium";
  if (target === "team-rater") return "click_team_rater";
  if (target === "qr") return "click_qr";
  return "click_original";
}

export function resolveGoDestination(
  target: ScoutGoTarget,
  originalUrl?: string | null,
): string {
  if (target === "premium" || target === "qr") return ffsPremiumUrl();
  if (target === "team-rater") return ffsTeamRaterUrl();
  return originalUrl?.trim() || FFS_SITE_URL;
}
