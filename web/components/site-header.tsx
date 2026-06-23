"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useEntryId } from "@/components/entry-id-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthNav } from "@/components/auth/auth-nav";
import { cn } from "@/lib/utils";

function isFplPath(pathname: string): boolean {
  return (
    pathname === "/fpl" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/manager" ||
    pathname.startsWith("/manager/") ||
    pathname === "/planner" ||
    pathname.startsWith("/planner/") ||
    pathname === "/players" ||
    pathname.startsWith("/player/") ||
    pathname === "/mini" ||
    pathname === "/chat"
  );
}

export function SiteHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname() ?? "";
  const { entryId } = useEntryId();
  const [open, setOpen] = useState(false);

  const dashboardHref = entryId ? `/dashboard/${entryId}` : "/dashboard";
  const plannerHref = entryId ? `/planner/${entryId}` : "/planner";
  const managerHref = entryId ? `/manager/${entryId}` : "/manager";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const mainLinks = [
    { href: "/", label: t("home"), active: pathname === "/" },
    { href: "/fpl", label: t("fpl"), active: isFplPath(pathname) },
    { href: "/worldcup", label: t("worldcup"), active: pathname === "/worldcup" },
    { href: "/news", label: t("news"), active: pathname === "/news" || pathname.startsWith("/news/") },
  ];

  const fplLinks = [
    { href: dashboardHref, label: t("dashboard") },
    { href: plannerHref, label: t("planner") },
    { href: managerHref, label: t("manager") },
    { href: "/players", label: t("players") },
    { href: "/mini", label: t("mini") },
    { href: "/chat", label: t("chat") },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="container flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted"
              aria-label={t("openMenu")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="min-w-0 truncate font-semibold tracking-tight text-foreground">
              <span className="text-brand-accent">Faleague</span>
              <span className="font-normal text-muted-foreground"> The Football Hub</span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-[100] flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label={t("closeMenu")}
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-[min(100%,18rem)] flex-col border-r border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">{t("menuTitle")}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                aria-label={t("closeMenu")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label={t("ariaMain")}>
              {mainLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    link.active
                      ? "bg-brand-accent/10 text-brand-accent"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("fplTools")}
              </p>
              {fplLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
              <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("affiliateTitle")}
              </p>
              <a
                href="https://faleague.cn"
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {t("faleagueCn")}
              </a>
            </nav>
            <div className="border-t border-border p-3">
              <AuthNav />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
