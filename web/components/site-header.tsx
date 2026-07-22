"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useEntryId } from "@/components/entry-id-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthNav } from "@/components/auth/auth-nav";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

function isHomePath(pathname: string): boolean {
  return pathname === "/";
}

function isWorldCupPath(pathname: string): boolean {
  return pathname === "/worldcup" || pathname.startsWith("/worldcup/");
}

function MenuSection({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "soft";
}) {
  return (
    <div className="mt-4 border-t border-border/40 pt-3.5">
      <div className="mb-1.5 flex items-center gap-2.5 px-3">
        <span
          className={cn(
            "h-3.5 w-0.5 shrink-0 rounded-full",
            tone === "soft" ? "bg-brand-accent/40" : "bg-brand-accent",
          )}
          aria-hidden
        />
        <p
          className={cn(
            "text-xs font-semibold leading-none tracking-wide",
            tone === "soft" ? "text-brand-accent/55" : "text-brand-accent",
          )}
        >
          {title}
        </p>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function MenuLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "nav-link-active bg-brand-accent/10 font-medium text-brand-accent"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export function SiteHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname() ?? "";
  const { entryId } = useEntryId();
  const { theme } = useAuth();
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

  return (
    <>
      <header className="site-header sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
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
            <Link href="/" className="flex min-w-0 items-center gap-2 truncate font-semibold tracking-tight text-foreground">
              <span className="text-brand-accent">Faleague</span>
              <span className="hidden font-normal text-muted-foreground sm:inline">
                The Football Hub
              </span>
              {theme && theme.label !== "FALEAGUE AI" ? (
                <span
                  className="hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline"
                  style={{
                    background: `linear-gradient(135deg, var(--team-secondary), var(--team-primary))`,
                    color: "var(--team-accent)",
                    border: "1px solid color-mix(in srgb, var(--team-primary) 45%, transparent)",
                  }}
                >
                  {theme.label}
                </span>
              ) : null}
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
            <nav className="flex flex-1 flex-col overflow-y-auto p-3" aria-label={t("ariaMain")}>
              <MenuLink href="/" label={t("home")} active={isHomePath(pathname)} />

              <MenuSection title={t("menuSectionTeam")}>
                <MenuLink
                  href={dashboardHref}
                  label={t("dashboard")}
                  active={pathname === "/dashboard" || pathname.startsWith("/dashboard/")}
                />
                <MenuLink
                  href={plannerHref}
                  label={t("planner")}
                  active={pathname === "/planner" || pathname.startsWith("/planner/")}
                />
                <MenuLink
                  href={managerHref}
                  label={t("manager")}
                  active={pathname === "/manager" || pathname.startsWith("/manager/")}
                />
              </MenuSection>

              <MenuSection title={t("menuSectionResearch")}>
                <MenuLink
                  href="/players"
                  label={t("players")}
                  active={pathname === "/players" || pathname.startsWith("/player/")}
                />
                <MenuLink
                  href="/fpl/fixtures"
                  label={t("fixtures")}
                  active={pathname === "/fpl/fixtures" || pathname.startsWith("/fpl/fixtures/")}
                />
                <MenuLink
                  href="/fpl/preseason"
                  label={t("preseason")}
                  active={pathname === "/fpl/preseason" || pathname.startsWith("/fpl/preseason/")}
                />
                <MenuLink
                  href="/fpl/historical"
                  label={t("historical")}
                  active={pathname === "/fpl/historical" || pathname.startsWith("/fpl/historical/")}
                />
              </MenuSection>

              <MenuSection title={t("menuSectionTools")}>
                <MenuLink href="/chat" label={t("chat")} active={pathname === "/chat"} />
                <MenuLink
                  href="/news"
                  label={t("news")}
                  active={
                    pathname === "/news" ||
                    (pathname.startsWith("/news") && !pathname.startsWith("/news/fpl-x"))
                  }
                />
                <MenuLink
                  href="/news/fpl-x"
                  label={t("newsFplX")}
                  active={pathname.startsWith("/news/fpl-x")}
                />
              </MenuSection>

              <MenuSection title={t("menuSectionGame")}>
                <MenuLink
                  href="/play/mini"
                  label={t("miniFpl")}
                  active={pathname === "/play/mini" || pathname === "/mini"}
                />
                <MenuLink
                  href="/play/wc-mini"
                  label={t("miniWc")}
                  active={pathname === "/play/wc-mini"}
                />
              </MenuSection>

              <MenuSection title={t("menuSectionWorldCup")}>
                <MenuLink
                  href="/worldcup"
                  label={t("worldcupCentre")}
                  active={isWorldCupPath(pathname)}
                />
              </MenuSection>

              <MenuSection title={t("affiliateTitle")} tone="soft">
                <a
                  href="https://faleague.cn"
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {t("faleagueCn")}
                </a>
              </MenuSection>
            </nav>
            <div className="border-t border-border p-3">
              <AuthNav layout="drawer" />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
