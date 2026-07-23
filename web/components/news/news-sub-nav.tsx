"use client";

import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { GatedLink } from "@/components/auth/gated-link";

export function NewsSubNav() {
  const t = useTranslations("newsIndex");
  const pathname = usePathname() ?? "";

  const tabs = [
    { href: "/news", label: t("navAllNews"), active: pathname === "/news", gated: false },
    {
      href: "/news/fpl-daily",
      label: t("navFplDaily"),
      active: pathname.startsWith("/news/fpl-daily"),
      gated: true,
    },
    {
      href: "/news/fpl-x",
      label: t("navFplX"),
      active: pathname.startsWith("/news/fpl-x"),
      gated: true,
    },
  ] as const;

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const className = cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors no-underline",
          tab.active
            ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
        );
        if (tab.gated) {
          return (
            <GatedLink key={tab.href} href={tab.href} className={className}>
              {tab.label}
            </GatedLink>
          );
        }
        return (
          <Link key={tab.href} href={tab.href} className={className}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
