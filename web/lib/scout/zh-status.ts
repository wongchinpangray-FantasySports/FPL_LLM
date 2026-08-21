export const SCOUT_TRANSLATE_BADGES = [
  "english_only",
  "requested",
  "translated",
  "failed",
] as const;
export type ScoutTranslateBadge = (typeof SCOUT_TRANSLATE_BADGES)[number];

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

export type ScoutZhFields = {
  title_en: string;
  title_zh?: string | null;
  excerpt_en?: string | null;
  excerpt_zh?: string | null;
  body_html_en?: string | null;
  body_html_zh?: string | null;
  translate_requested_at?: string | null;
  translation_error?: string | null;
};

export function looksLikeChinese(text: string | null | undefined): boolean {
  return Boolean(text && CJK_RE.test(text));
}

/** Gemini 429 / missing-key leftovers that are not real translation failures. */
export function isGeminiNoiseError(error: string | null | undefined): boolean {
  if (!error) return false;
  return /GEMINI_API_KEY|GOOGLE_API_KEY|429|RESOURCE_EXHAUSTED|Too Many Requests|quota/i.test(
    error,
  );
}

/**
 * True when ZH is empty, an English copy, or otherwise not Simplified Chinese.
 * `title_zh === title_en` is the ingest failure mode that made admin look translated.
 */
export function isPlaceholderZh(input: ScoutZhFields): boolean {
  const titleZh = (input.title_zh ?? "").trim();
  const titleEn = input.title_en.trim();
  const bodyZh = (input.body_html_zh ?? "").trim();
  const bodyEn = (input.body_html_en ?? "").trim();
  if (!titleZh && !bodyZh) return true;
  if (titleZh && titleEn && titleZh === titleEn) return true;
  if (bodyZh && bodyEn && bodyZh === bodyEn) return true;
  const excerptZh = (input.excerpt_zh ?? "").trim();
  const excerptEn = (input.excerpt_en ?? "").trim();
  if (
    excerptZh &&
    excerptEn &&
    excerptZh === excerptEn &&
    !looksLikeChinese(titleZh) &&
    !looksLikeChinese(bodyZh)
  ) {
    return true;
  }
  if (
    !looksLikeChinese(titleZh) &&
    !looksLikeChinese(bodyZh) &&
    (titleZh || bodyZh)
  ) {
    return true;
  }
  return false;
}

export function hasRealScoutZh(input: ScoutZhFields): boolean {
  return (
    !isPlaceholderZh(input) &&
    (looksLikeChinese(input.title_zh) || looksLikeChinese(input.body_html_zh))
  );
}

export function scoutTranslateBadge(input: ScoutZhFields): ScoutTranslateBadge {
  if (input.translate_requested_at) return "requested";
  if (input.translation_error && !hasRealScoutZh(input)) return "failed";
  if (hasRealScoutZh(input)) return "translated";
  return "english_only";
}

export function displayScoutTitle(input: ScoutZhFields): string {
  if (hasRealScoutZh(input) && input.title_zh?.trim()) return input.title_zh.trim();
  return input.title_en;
}

export function displayScoutExcerpt(input: ScoutZhFields): string | null {
  if (hasRealScoutZh(input) && input.excerpt_zh?.trim()) {
    return input.excerpt_zh.trim();
  }
  return input.excerpt_en?.trim() || null;
}

export function displayScoutBody(input: ScoutZhFields): string {
  if (hasRealScoutZh(input) && input.body_html_zh?.trim()) {
    return input.body_html_zh;
  }
  return input.body_html_en ?? "";
}

export function isScoutTranslateBadge(
  value: string,
): value is ScoutTranslateBadge {
  return (SCOUT_TRANSLATE_BADGES as readonly string[]).includes(value);
}
