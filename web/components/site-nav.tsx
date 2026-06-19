"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useEntryId } from "@/components/entry-id-context";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  children,
  active,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative block rounded-md px-2 py-1.5 text-xs transition-colors sm:text-sm",
        active
          ? "text-foreground after:absolute after:inset-x-1 after:-bottom-0.5 after:h-px after:bg-brand-accent after:shadow-[0_0_12px_rgba(0,255,135,0.6)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function isFplPath(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/manager" ||
    pathname.startsWith("/manager/") ||
    pathname === "/planner" ||
    pathname.startsWith("/planner/") ||
    pathname === "/players" ||
    pathname.startsWith("/player/") ||
    pathname === "/mini"
  );
}

export function SiteNav() {
  const t = useTranslations("nav");
  const pathname = usePathname() ?? "";
  const { entryId } = useEntryId();
  const [fplOpen, setFplOpen] = useState(false);
  const fplRef = useRef<HTMLDivElement>(null);

  const dashboardHref = entryId ? `/dashboard/${entryId}` : "/dashboard";
  const plannerHref = entryId ? `/planner/${entryId}` : "/planner";
  const managerHref = entryId ? `/manager/${entryId}` : "/manager";
  const fplActive = isFplPath(pathname);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!fplRef.current?.contains(e.target as Node)) setFplOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    setFplOpen(false);
  }, [pathname]);

  const fplLinks = [
    { href: dashboardHref, label: t("dashboard"), active: pathname === "/dashboard" || pathname.startsWith("/dashboard/") },
    { href: managerHref, label: t("manager"), active: pathname === "/manager" || pathname.startsWith("/manager/") },
    { href: plannerHref, label: t("planner"), active: pathname === "/planner" || pathname.startsWith("/planner/") },
    { href: "/players", label: t("players"), active: pathname === "/players" || pathname.startsWith("/player/") },
    { href: "/mini", label: t("mini"), active: pathname === "/mini" },
  ];

  return (
    <nav
      className="flex flex-wrap items-center gap-1 sm:gap-2"
      aria-label={t("ariaMain")}
    >
      <NavLink href="/" active={pathname === "/"}>
        {t("home")}
      </NavLink>
      <NavLink href="/chat" active={pathname === "/chat"}>
        {t("chat")}
      </NavLink>

      <div ref={fplRef} className="relative">
        <button
          type="button"
          aria-expanded={fplOpen}
          aria-haspopup="true"
          onClick={(e) => {
            e.stopPropagation();
            setFplOpen((o) => !o);
          }}
          className={cn(
            "relative rounded-md px-1.5 py-1 text-xs transition-colors sm:px-2 sm:py-1.5 sm:text-sm",
            fplActive || fplOpen
              ? "text-foreground after:absolute after:inset-x-1 after:-bottom-0.5 after:h-px after:bg-brand-accent after:shadow-[0_0_12px_rgba(0,255,135,0.6)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("fpl")}
          <span className="ml-0.5 text-[10px] opacity-70" aria-hidden>
            ▾
          </span>
        </button>
        {fplOpen ? (
          <div
            className={cn(
              "absolute left-0 top-full z-50 mt-1 min-w-[10.5rem] rounded-lg border border-border",
              "bg-popover/95 py-1 shadow-xl backdrop-blur-xl",
            )}
          >
            {fplLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                active={link.active}
                onClick={() => setFplOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        ) : null}
      </div>

      <NavLink href="/worldcup" active={pathname === "/worldcup"}>
        {t("worldcup")}
      </NavLink>
      <NavLink href="/news" active={pathname === "/news"}>
        {t("news")}
      </NavLink>
    </nav>
  );
}
