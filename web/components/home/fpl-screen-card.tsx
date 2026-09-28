"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { founderPackIsPublic } from "@/lib/billing/founder-pack";
import {
  defaultIntentFor,
  destinationFor,
  isFplNewbie,
  menuPathKey,
  readFplScreen,
  writeFplScreen,
  type FplIntent,
  type FplTenure,
} from "@/lib/fpl/first-visit-screen";

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-left text-sm transition-colors",
        active
          ? "bg-brand-accent/20 font-medium text-brand-accent"
          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const TENURE_KEYS: Record<FplTenure, "tenureNew" | "tenureMid" | "tenureVet"> = {
  new: "tenureNew",
  mid: "tenureMid",
  vet: "tenureVet",
};

const INTENT_KEYS: Record<
  FplIntent,
  "intentGuide" | "intentStats" | "intentPlanner" | "intentMini" | "intentPro"
> = {
  guide: "intentGuide",
  stats: "intentStats",
  planner: "intentPlanner",
  mini: "intentMini",
  pro: "intentPro",
};

/** Always visible on the guest homepage — does not hide after an answer. */
export function FplScreenCard() {
  const t = useTranslations("fplScreen");
  const [tenure, setTenure] = useState<FplTenure | null>(null);
  const [intent, setIntent] = useState<FplIntent | null>(null);

  useEffect(() => {
    const existing = readFplScreen();
    if (!existing) return;
    setTenure(existing.tenure);
    setIntent(existing.intent);
  }, []);

  const showPro = founderPackIsPublic();
  const intents: FplIntent[] = showPro
    ? ["guide", "stats", "planner", "mini", "pro"]
    : ["guide", "stats", "planner", "mini"];

  function pickTenure(next: FplTenure) {
    setTenure(next);
    setIntent(defaultIntentFor(next));
  }

  const result = tenure && intent ? { tenure, intent } : null;
  const dest = result ? destinationFor(result) : null;
  const signupHref = dest
    ? `/auth/signup?next=${encodeURIComponent(dest.href)}`
    : "/auth/signup";
  const goHref = dest && dest.needsAuth ? signupHref : (dest?.href ?? "/");

  return (
    <section className="rounded-xl border border-brand-accent/35 bg-background/40 px-4 py-4 md:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
        {t("eyebrow")}
      </p>
      <h2 className="mt-1.5 text-base font-semibold text-foreground sm:text-lg">
        {t("title")}
      </h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["new", "mid", "vet"] as const).map((value) => (
          <Chip
            key={value}
            active={tenure === value}
            onClick={() => pickTenure(value)}
          >
            {t(TENURE_KEYS[value])}
          </Chip>
        ))}
      </div>

      {tenure ? (
        <>
          <p className="mt-4 text-sm font-medium text-foreground">{t("intentTitle")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {intents.map((value) => (
              <Chip
                key={value}
                active={intent === value}
                onClick={() => setIntent(value)}
              >
                {t(INTENT_KEYS[value])}
                {value === defaultIntentFor(tenure) ? ` · ${t("recommended")}` : null}
              </Chip>
            ))}
          </div>
        </>
      ) : null}

      {result && dest ? (
        <div className="mt-4 rounded-lg border border-border/80 bg-background/60 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            {isFplNewbie(result.tenure) ? t("resultNewbieTitle") : t("resultVeteranTitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isFplNewbie(result.tenure) ? t("resultNewbieBody") : t("resultVeteranBody")}
          </p>
          <p className="mt-2 text-xs font-medium text-brand-accent">
            {t("resultPath", { path: t(menuPathKey(result.intent)) })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={goHref}
              onClick={() => writeFplScreen(result)}
              className={cn(buttonVariants({ size: "sm" }), "no-underline")}
            >
              {dest.needsAuth ? t("ctaSignup") : t("ctaGo")}
            </Link>
            {dest.needsAuth ? null : (
              <Link
                href={signupHref}
                onClick={() => writeFplScreen(result)}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "no-underline",
                )}
              >
                {t("ctaSignup")}
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
