export const SHARE_KINDS = [
  "price_forecast",
  "insight",
  "scout_article",
  "player",
  "mini_leaderboard",
  "manager",
] as const;

export type ShareKind = (typeof SHARE_KINDS)[number];

export type ShareLink = {
  id: string;
  code: string;
  kind: ShareKind;
  target_path: string;
  title: string;
  ref_id: string | null;
  created_at: string;
};

export type SharePreviewItem = {
  label: string;
  value: string;
  hint?: string;
};

export type SharePreview = {
  kind: ShareKind;
  title: string;
  subtitle: string | null;
  href: string;
  items: SharePreviewItem[];
};

export function isShareKind(value: string): value is ShareKind {
  return (SHARE_KINDS as readonly string[]).includes(value);
}
