import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

const LOCALE_PREFIX = new RegExp(
  `^/(${routing.locales.join("|")})(?=\\/|$)`,
);

/** Remove leading /en or /zh so next-intl router does not double-prefix. */
export function stripLocalePrefix(pathname: string): string {
  const stripped = pathname.replace(LOCALE_PREFIX, "");
  if (stripped) return stripped;
  return LOCALE_PREFIX.test(pathname) ? "/" : pathname;
}
