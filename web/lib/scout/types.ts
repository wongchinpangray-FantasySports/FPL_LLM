export const SCOUT_STATUSES = ["pending", "published", "hidden"] as const;
export type ScoutArticleStatus = (typeof SCOUT_STATUSES)[number];

export const SCOUT_SERIES = [
  "team_guide",
  "scout_report",
  "scout_notes",
  "preview",
  "review",
  "team_news",
  "scout_squad",
  "other",
] as const;
export type ScoutSeries = (typeof SCOUT_SERIES)[number];

export const SCOUT_EVENT_TYPES = [
  "pageview",
  "click_premium",
  "click_team_rater",
  "click_original",
  "click_qr",
] as const;
export type ScoutEventType = (typeof SCOUT_EVENT_TYPES)[number];

export const SCOUT_GO_TARGETS = [
  "premium",
  "team-rater",
  "original",
  "qr",
] as const;
export type ScoutGoTarget = (typeof SCOUT_GO_TARGETS)[number];

export const SCOUT_CHANNELS = ["wechat", "xhs", "twitter", "other"] as const;
export type ScoutChannel = (typeof SCOUT_CHANNELS)[number];

export type ScoutImage = {
  src: string;
  alt: string;
};

export type ScoutArticle = {
  id: string;
  slug: string;
  source_guid: string;
  source_url: string;
  title_en: string;
  title_zh: string;
  excerpt_en: string | null;
  excerpt_zh: string | null;
  author: string | null;
  categories: string[];
  series: ScoutSeries;
  hero_image_url: string | null;
  images: ScoutImage[];
  body_html_en: string | null;
  body_html_zh: string | null;
  content_hash: string | null;
  status: ScoutArticleStatus;
  source_published_at: string | null;
  translated_at: string | null;
  pushed_at: string | null;
  translation_model: string | null;
  translation_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ScoutArticleListItem = Omit<
  ScoutArticle,
  "body_html_en" | "body_html_zh"
>;

export type ScoutRssItem = {
  title: string;
  url: string;
  guid: string;
  excerpt: string;
  author: string | null;
  published_at: string | null;
  categories: string[];
};

export type ScoutEventInput = {
  event_type: ScoutEventType;
  article_id?: string | null;
  slug?: string | null;
  visitor_id?: string | null;
  user_id?: string | null;
  referrer?: string | null;
  path?: string | null;
  meta?: Record<string, unknown>;
};

export type ScoutDistributionLog = {
  id: string;
  logged_at: string;
  channel: ScoutChannel;
  note: string | null;
  article_id: string | null;
  created_by: string | null;
};

export type ScoutArticleStats = {
  article_id: string;
  slug: string;
  title_zh: string;
  title_en: string;
  status: ScoutArticleStatus;
  pageviews: number;
  unique_visitors: number;
  click_premium: number;
  click_team_rater: number;
  click_original: number;
  click_qr: number;
};

export type ScoutTrialStats = {
  from: string;
  to: string;
  published_count: number;
  pending_count: number;
  hidden_count: number;
  pageviews: number;
  unique_visitors: number;
  click_premium: number;
  click_team_rater: number;
  click_original: number;
  click_qr: number;
  distribution_count: number;
  pro_users: number;
  top_articles: ScoutArticleStats[];
  articles: ScoutArticleStats[];
};

export function isScoutStatus(value: string): value is ScoutArticleStatus {
  return (SCOUT_STATUSES as readonly string[]).includes(value);
}

export function isScoutGoTarget(value: string): value is ScoutGoTarget {
  return (SCOUT_GO_TARGETS as readonly string[]).includes(value);
}

export function isScoutChannel(value: string): value is ScoutChannel {
  return (SCOUT_CHANNELS as readonly string[]).includes(value);
}

export function isScoutEventType(value: string): value is ScoutEventType {
  return (SCOUT_EVENT_TYPES as readonly string[]).includes(value);
}
