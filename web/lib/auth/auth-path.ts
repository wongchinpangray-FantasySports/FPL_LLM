import { routing } from "@/i18n/routing";

/** Locale-aware app path (`as-needed`: default locale has no prefix). */
export function localePath(locale: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === routing.defaultLocale) return normalized;
  return `/${locale}${normalized}`;
}
