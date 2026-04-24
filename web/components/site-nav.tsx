"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEntryId } from "@/components/entry-id-form";
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
  const pathname = usePathname();
  const { entryId } = useEntryId();

  const dashboardHref = entryId ? `/dashboard/${entryId}` : null;
  const plannerHref = entryId ? `/planner/${entryId}` : null;

  return (
    <nav
      className="flex flex-wrap items-center gap-1 sm:gap-2"
      aria-label="Main"
    >
      <NavLink href="/" active={pathname === "/"}>
        Home
      </NavLink>
      <NavLink href="/chat" active={pathname === "/chat"}>
        Chat
      </NavLink>
      {dashboardHref ? (
        <NavLink
          href={dashboardHref}
          active={pathname.startsWith("/dashboard/")}
        >
          Dashboard
        </NavLink>
      ) : null}
      {plannerHref ? (
        <NavLink href={plannerHref} active={pathname.startsWith("/planner/")}>
          Planner
        </NavLink>
      ) : null}
    </nav>
  );
}
