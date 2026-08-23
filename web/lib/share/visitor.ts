export const SHARE_VISITOR_COOKIE = "fl_share_vid";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isShareVisitorId(value: string | undefined | null): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function newShareVisitorId(): string {
  return crypto.randomUUID();
}

export const SHARE_VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
