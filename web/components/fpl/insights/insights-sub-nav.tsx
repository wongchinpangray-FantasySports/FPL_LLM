"use client";

import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { INSIGHT_CATALOG } from "@/lib/fpl/insights/catalog";

export function InsightsSubNav() {
  const t = useTranslations("fplInsights");
  const pathname = usePathname() ?? "";

  const tabs = [
    { href: "/fpl/insights", label: t("navHub"), match: (p: string) => p === "/fpl/insights" },
    ...INSIGHT_CATALOG.filter(
      (entry) =>
        entry.href.startsWith("/fpl/insights/") || entry.id === "historical",
    ).map((entry) => ({
      href: entry.href,
      label: t(entry.titleKey as Parameters<typeof t>[0]),
      match: (p: string) => p === entry.href || p.startsWith(`${entry.href}/`),
    })),
  ];

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors no-underline",
            tab.match(pathname)
              ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
