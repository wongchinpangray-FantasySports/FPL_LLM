import { defineRouting } from "next-intl/routing";

/**
 * Public site is Chinese-only (FFS SEO partnership: avoid EN content competing
 * with fantasyfootballscout.co.uk). Legacy `/en/*` is redirected in middleware.
 */
export const routing = defineRouting({
  locales: ["zh"],
  defaultLocale: "zh",
  localePrefix: "as-needed",
});

/** Legacy + current locale prefixes that may appear in bookmarks or cookies. */
const LOCALE_PREFIX = /^\/(en|zh)(?=\/|$)/;

/** Remove leading /en or /zh so next-intl router does not double-prefix. */
export function stripLocalePrefix(pathname: string): string {
  const stripped = pathname.replace(LOCALE_PREFIX, "");
  if (stripped) return stripped;
  return LOCALE_PREFIX.test(pathname) ? "/" : pathname;
}
