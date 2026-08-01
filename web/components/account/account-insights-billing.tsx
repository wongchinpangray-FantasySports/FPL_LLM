"use client";

import { useSearchParams } from "next/navigation";
import {
  InsightsManageBillingButton,
  InsightsUpgradeButton,
} from "@/components/fpl/insights/insights-upgrade-button";

export function AccountInsightsBilling({
  plan,
  expiresAt,
  billingConfigured,
  labels,
}: {
  plan: "free" | "premium";
  expiresAt: string | null;
  billingConfigured: boolean;
  labels: {
    title: string;
    body: string;
    active: string;
    free: string;
    expires: string;
    upgrade: string;
    manage: string;
    success: string;
    cancelled: string;
    comingSoon: string;
  };
}) {
  const searchParams = useSearchParams();
  const flash = searchParams.get("insights");

  const expiresLabel =
    expiresAt != null
      ? new Date(expiresAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {labels.body}
      </p>

      {flash === "success" ? (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {labels.success}
        </p>
      ) : null}
      {flash === "cancelled" ? (
        <p className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {labels.cancelled}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span
          className={
            plan === "premium"
              ? "rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300"
              : "rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          }
        >
          {plan === "premium" ? labels.active : labels.free}
        </span>
        {plan === "premium" && expiresLabel ? (
          <span className="text-xs text-muted-foreground">
            {labels.expires.replace("{date}", expiresLabel)}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {plan === "premium" ? (
          billingConfigured ? (
            <InsightsManageBillingButton
              label={labels.manage}
              returnPath="/account"
            />
          ) : null
        ) : billingConfigured ? (
          <InsightsUpgradeButton
            label={labels.upgrade}
            returnPath="/account"
          />
        ) : (
          <p className="text-sm text-muted-foreground">{labels.comingSoon}</p>
        )}
      </div>
    </div>
  );
}
