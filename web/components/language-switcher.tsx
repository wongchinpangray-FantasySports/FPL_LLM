"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname() ?? "";
  const router = useRouter();

  // Site is Chinese-only (FFS SEO); hide the switcher when a single locale is live.
  if (routing.locales.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="text-muted-foreground">{t("label")}</span>
      <span className="text-muted-foreground/80">·</span>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          className={cn(
            "rounded px-1.5 py-0.5 transition-colors",
            locale === loc
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {loc === "zh" ? t("zh") : t("en")}
        </button>
      ))}
    </div>
  );
}
