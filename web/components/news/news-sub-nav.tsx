"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function NewsSubNav() {
  const t = useTranslations("newsIndex");
  const pathname = usePathname() ?? "";

  const tabs = [
    { href: "/news", label: t("navAllNews"), active: pathname === "/news" },
    {
      href: "/news/fpl-daily",
      label: t("navFplDaily"),
      active: pathname.startsWith("/news/fpl-daily"),
    },
    {
      href: "/news/fpl-x",
      label: t("navFplX"),
      active: pathname.startsWith("/news/fpl-x"),
    },
  ] as const;

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors no-underline",
            tab.active
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
