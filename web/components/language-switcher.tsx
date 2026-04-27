"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="text-slate-500">{t("label")}</span>
      <span className="text-slate-600">·</span>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          className={cn(
            "rounded px-1.5 py-0.5 transition-colors",
            locale === loc
              ? "bg-white/10 font-medium text-white"
              : "text-slate-400 hover:text-white",
          )}
        >
          {loc === "en" ? t("en") : t("zh")}
        </button>
      ))}
    </div>
  );
}
