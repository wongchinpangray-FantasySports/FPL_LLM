import type { WcNewsItem } from "@/lib/wc/news-feeds";
import { fetchFeedXml, parseRssItems } from "@/lib/wc/news-feeds";

export type FplCreatorKind = "articles" | "youtube" | "podcast";

export type FplCreatorSource = {
  slug: string;
  name: string;
  kind: FplCreatorKind;
  url: string;
  siteUrl: string;
  maxItems: number;
};

/** Public RSS / YouTube feeds for FPL creators (not Facebook — use open syndication). */
export const FPL_CREATOR_SOURCES: FplCreatorSource[] = [
  {
    slug: "ffscout",
    name: "Fantasy Football Scout",
    kind: "articles",
    url: "https://www.fantasyfootballscout.co.uk/feed/",
    siteUrl: "https://www.fantasyfootballscout.co.uk/",
    maxItems: 8,
  },
  {
    slug: "fpl-harry",
    name: "FPL Harry",
    kind: "podcast",
    url: "https://feeds.megaphone.fm/BLU5639728837",
    siteUrl: "https://www.youtube.com/c/FPLHarry",
    maxItems: 6,
  },
  {
    slug: "lets-talk-fpl",
    name: "Let's Talk FPL",
    kind: "youtube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCxeOc7eFxq37yW_Nc-69deA",
    siteUrl: "https://www.youtube.com/c/letstalkfpl",
    maxItems: 6,
  },
  {
    slug: "lets-talk-fpl",
    name: "Let's Talk FPL",
    kind: "podcast",
    url: "https://feeds.megaphone.fm/COMG4898871165",
    siteUrl: "https://www.youtube.com/c/letstalkfpl",
    maxItems: 6,
  },
  {
    slug: "ffhub",
    name: "Fantasy Football Hub",
    kind: "youtube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCcqEr3DfrRwtoF2a1yW8qgQ",
    siteUrl: "https://www.youtube.com/c/FantasyFootballHub",
    maxItems: 6,
  },
  {
    slug: "ffhub",
    name: "Fantasy Football Hub",
    kind: "podcast",
    url: "https://feeds.megaphone.fm/COMG9112865919",
    siteUrl: "https://www.fantasyfootballhub.co.uk/",
    maxItems: 6,
  },
];

function dedupeKey(title: string, url: string): string {
  const normTitle = title
    .toLowerCase()
    .replace(/\s*[-–|]\s*[^-|–]+$/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  try {
    const u = new URL(url);
    return `${normTitle}|${u.hostname}${u.pathname}`.slice(0, 240);
  } catch {
    return `${normTitle}|${url}`.slice(0, 240);
  }
}

function youtubeThumbnail(url: string): string | null {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("v") ?? u.pathname.split("/").pop();
    if (!id || id.length < 6) return null;
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  } catch {
    return null;
  }
}

function kindLabel(kind: FplCreatorKind): string {
  if (kind === "youtube") return "YouTube";
  if (kind === "podcast") return "Podcast";
  return "Article";
}

export function creatorSlugFromFeedId(feed_id: string): string | null {
  const m = feed_id.match(/^fpl-creator-([a-z0-9-]+)-/);
  return m?.[1] ?? null;
}

export function creatorKindFromFeedId(feed_id: string): FplCreatorKind | null {
  const m = feed_id.match(/^fpl-creator-[a-z0-9-]+-(articles|youtube|podcast)$/);
  return (m?.[1] as FplCreatorKind | undefined) ?? null;
}

export async function fetchFplCreatorsItems(opts?: {
  limit?: number;
}): Promise<WcNewsItem[]> {
  const limit = Math.min(80, Math.max(10, opts?.limit ?? 48));
  const out: WcNewsItem[] = [];
  const seen = new Set<string>();

  for (const source of FPL_CREATOR_SOURCES) {
    const xml = await fetchFeedXml(source.url);
    if (!xml) continue;

    const parsed = parseRssItems(xml);
    let added = 0;

    for (const row of parsed) {
      if (added >= source.maxItems) break;
      const key = dedupeKey(row.title, row.url);
      if (seen.has(key)) continue;
      seen.add(key);

      const image_url =
        row.image_url ??
        (source.kind === "youtube" ? youtubeThumbnail(row.url) : null);

      out.push({
        id: `fpl-creator-${source.slug}-${source.kind}:${key.slice(0, 120)}`,
        title: row.title,
        url: row.url,
        summary: row.summary,
        image_url,
        published_at: row.published_at,
        outlet: source.name,
        region: "UK",
        lang: "en",
        feed_id: `fpl-creator-${source.slug}-${source.kind}`,
        category: "creators",
        editorial_score: 0,
        is_editorial: false,
      });
      added += 1;
    }
  }

  out.sort((a, b) => {
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });

  return out.slice(0, limit);
}

export function fplCreatorKindLabel(kind: FplCreatorKind): string {
  return kindLabel(kind);
}

export const FPL_CREATOR_SLUGS = [
  "ffscout",
  "fpl-harry",
  "lets-talk-fpl",
  "ffhub",
] as const;

export type FplCreatorSlug = (typeof FPL_CREATOR_SLUGS)[number];

export function fplCreatorDisplayName(slug: FplCreatorSlug): string {
  const names: Record<FplCreatorSlug, string> = {
    ffscout: "Fantasy Football Scout",
    "fpl-harry": "FPL Harry",
    "lets-talk-fpl": "Let's Talk FPL",
    ffhub: "Fantasy Football Hub",
  };
  return names[slug];
}
