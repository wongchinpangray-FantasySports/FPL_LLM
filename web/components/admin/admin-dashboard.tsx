"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { AdminScoutArticlesPanel } from "@/components/admin/admin-scout-articles-panel";
import { AdminScoutTrialPanel } from "@/components/admin/admin-scout-trial-panel";
import { AdminMiniLeagueBetaPanel } from "@/components/admin/admin-mini-league-beta-panel";
import { AdminSiteActivityPanel } from "@/components/admin/admin-site-activity-panel";

type Tab = "activity" | "users" | "articles" | "trial" | "miniLeagueBeta";

export function AdminDashboard({ locale }: { locale: string }) {
  const t = useTranslations("adminScout");
  const tUsers = useTranslations("admin");
  const [tab, setTab] = useState<Tab>("activity");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {(
          [
            ["activity", t("tabActivity")],
            ["articles", t("tabArticles")],
            ["trial", t("tabTrial")],
            ["miniLeagueBeta", t("tabMiniLeagueBeta")],
            ["users", tUsers("title")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
              tab === id
                ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "activity" ? <AdminSiteActivityPanel locale={locale} /> : null}
      {tab === "users" ? <AdminUsersPanel locale={locale} /> : null}
      {tab === "articles" ? <AdminScoutArticlesPanel locale={locale} /> : null}
      {tab === "trial" ? <AdminScoutTrialPanel locale={locale} /> : null}
      {tab === "miniLeagueBeta" ? <AdminMiniLeagueBetaPanel locale={locale} /> : null}
    </div>
  );
}
