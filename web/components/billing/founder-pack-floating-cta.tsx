"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  FOUNDER_PACK_PATH,
  founderPackIsPublic,
} from "@/lib/billing/founder-pack";

/** Sticky PRO chip for signed-in non-premium only — guests see free signup first. */
export function FounderPackFloatingCta() {
  const pathname = usePathname() ?? "";
  const t = useTranslations("nav");
  const { user, profile, loading } = useAuth();

  if (loading || !user) return null;
  if (profile?.insights_plan === "premium") return null;
  if (!founderPackIsPublic()) return null;
  if (pathname === "/pro" || pathname.startsWith("/pro/")) return null;
  if (pathname.startsWith("/auth")) return null;
  if (pathname.startsWith("/scout")) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-4 z-[160] sm:bottom-6 sm:right-6">
      <Link
        href={FOUNDER_PACK_PATH}
        className="pointer-events-auto inline-flex max-w-[12.5rem] items-center justify-center rounded-full border border-amber-400/60 bg-amber-400 px-4 py-3 text-center text-xs font-bold leading-snug text-brand-ink shadow-[0_8px_24px_rgba(0,0,0,0.35)] no-underline hover:bg-amber-300 sm:max-w-[14rem] sm:px-5 sm:text-sm"
      >
        {t("founderPackFloat")}
      </Link>
    </div>
  );
}
