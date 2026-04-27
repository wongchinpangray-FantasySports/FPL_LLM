"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useEntryId } from "@/components/entry-id-context";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "text-white after:absolute after:inset-x-1 after:-bottom-0.5 after:h-px after:bg-brand-accent after:shadow-[0_0_12px_rgba(0,255,135,0.6)]"
          : "text-slate-400 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}

export function SiteNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { entryId } = useEntryId();

  const dashboardHref = entryId ? `/dashboard/${entryId}` : "/dashboard";
  const plannerHref = entryId ? `/planner/${entryId}` : "/planner";

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
      <NavLink
        href={dashboardHref}
        active={
          pathname === "/dashboard" || pathname.startsWith("/dashboard/")
        }
      >
        {t("dashboard")}
      </NavLink>
      <NavLink
        href={plannerHref}
        active={pathname === "/planner" || pathname.startsWith("/planner/")}
      >
        {t("planner")}
      </NavLink>
    </nav>
  );
}
