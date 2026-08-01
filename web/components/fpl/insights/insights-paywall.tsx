"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { InsightsUpgradeButton } from "@/components/fpl/insights/insights-upgrade-button";

export function InsightsPaywall({
  title,
  body,
  signInLabel,
  upgradeLabel,
  returnPath,
  locale,
  preview,
}: {
  title: string;
  body: string;
  signInLabel: string;
  upgradeLabel: string;
  returnPath?: string;
  locale?: string;
  preview?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/25 bg-card">
      {preview ? (
        <div className="pointer-events-none max-h-48 overflow-hidden opacity-40 blur-[1px]">
          {preview}
        </div>
      ) : null}
      <div className="border-t border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-card px-4 py-5 sm:px-6">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <InsightsUpgradeButton
            label={upgradeLabel}
            returnPath={returnPath}
            locale={locale}
          />
          <Link
            href="/sign-in"
            className="inline-flex rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-muted/80"
          >
            {signInLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
