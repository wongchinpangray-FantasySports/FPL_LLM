"use client";

import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  INSIGHT_CATALOG,
  insightNavLabelKey,
} from "@/lib/fpl/insights/catalog";

export function InsightsSubNav() {
  const t = useTranslations("fplInsights");
  const pathname = usePathname() ?? "";

  const tabs = [
    {
      href: "/fpl/insights",
      label: t("navHub"),
      match: (p: string) => p === "/fpl/insights",
    },
    ...INSIGHT_CATALOG.filter(
      (entry) =>
        entry.status === "live" &&
        (entry.href.startsWith("/fpl/insights/") || entry.id === "historical"),
    ).map((entry) => ({
      href: entry.href,
      label: t(insightNavLabelKey(entry) as Parameters<typeof t>[0]),
      match: (p: string) => p === entry.href || p.startsWith(`${entry.href}/`),
    })),
  ];

  return (
    <nav
      aria-label={t("navAria")}
      className="rounded-xl border border-border bg-card/40 p-2"
    >
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors no-underline",
              tab.match(pathname)
                ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
