import type { WcNewsItem } from "@/lib/wc/news-feeds";

export type FplCreatorKind = "articles" | "youtube" | "podcast";

export type FplCreatorSource = {
  slug: string;
  name: string;
  kind: FplCreatorKind;
  url: string;
  siteUrl: string;
  maxItems: number;
};

/**
 * Disabled for Fantasy Football Scout exclusivity — we no longer syndicate
 * third-party FPL creator RSS / YouTube / podcast feeds on Faleague.
 * Scout content is handled via the partner localisation path instead.
 */
export const FPL_CREATOR_SOURCES: FplCreatorSource[] = [];

export function isFplCreatorFeedId(feedId: string): boolean {
  return feedId.startsWith("fpl-creator-");
}

export function creatorSlugFromFeedId(feed_id: string): string | null {
  const m = feed_id.match(/^fpl-creator-([a-z0-9-]+)-/);
  return m?.[1] ?? null;
}

export function creatorKindFromFeedId(feed_id: string): FplCreatorKind | null {
  const m = feed_id.match(
    /^fpl-creator-[a-z0-9-]+-(articles|youtube|podcast)$/,
  );
  return (m?.[1] as FplCreatorKind | undefined) ?? null;
}

/** Always empty — creator syndication retired for FFS partnership exclusivity. */
export async function fetchFplCreatorsItems(_opts?: {
  limit?: number;
}): Promise<WcNewsItem[]> {
  return [];
}

export function fplCreatorKindLabel(kind: FplCreatorKind): string {
  if (kind === "youtube") return "YouTube";
  if (kind === "podcast") return "Podcast";
  return "Article";
}

export const FPL_CREATOR_SLUGS = [] as const;

export type FplCreatorSlug = string;

export function fplCreatorDisplayName(slug: string): string {
  return slug;
}
