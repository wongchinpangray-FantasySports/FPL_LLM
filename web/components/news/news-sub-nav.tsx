"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function NewsSubNav() {
  const t = useTranslations("newsIndex");
  const pathname = usePathname() ?? "";
  const onFplX = pathname.startsWith("/news/fpl-x");

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link
        href="/news"
        className={cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors no-underline",
          !onFplX
            ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        {t("navAllNews")}
      </Link>
      <Link
        href="/news/fpl-x"
        className={cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors no-underline",
          onFplX
            ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        {t("navFplX")}
      </Link>
    </div>
  );
}
