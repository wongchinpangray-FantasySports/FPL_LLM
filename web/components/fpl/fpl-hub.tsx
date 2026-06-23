"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useEntryId } from "@/components/entry-id-context";
import { EntryIdForm } from "@/components/entry-id-form";
import { cn } from "@/lib/utils";

function HubTile({
  href,
  title,
  description,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border p-4 no-underline transition-colors",
        accent
          ? "border-brand-accent/30 bg-brand-accent/5 hover:bg-brand-accent/10"
          : "border-border bg-card hover:border-brand-accent/25 hover:bg-muted/50",
      )}
    >
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

export function FplHub() {
  const t = useTranslations("fplHub");
  const { entryId } = useEntryId();
  const dashboardHref = entryId ? `/dashboard/${entryId}` : "/dashboard";
  const plannerHref = entryId ? `/planner/${entryId}` : "/planner";
  const managerHref = entryId ? `/manager/${entryId}` : "/manager";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-card/50 p-4">
        <h2 className="text-sm font-semibold text-foreground">{t("entryTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("entryHint")}</p>
        <div className="mt-3">
          <EntryIdForm redirectTo={(id) => `/dashboard/${id}`} />
        </div>
      </section>

      <HubTile
        href="/chat"
        title={t("chatTitle")}
        description={t("chatBody")}
        accent
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <HubTile href={dashboardHref} title={t("dashboard")} description={t("dashboardBody")} />
        <HubTile href={plannerHref} title={t("planner")} description={t("plannerBody")} />
        <HubTile href={managerHref} title={t("manager")} description={t("managerBody")} />
        <HubTile href="/players" title={t("players")} description={t("playersBody")} />
        <HubTile href="/mini" title={t("mini")} description={t("miniBody")} />
        <HubTile
          href="/fpl/fixtures"
          title={t("fixturesLinkTitle")}
          description={t("fixturesLinkBody")}
        />
      </div>
    </div>
  );
}
