"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  VALUE_BAND_POSITION_ORDER,
  formatValueBandPrice,
  groupValueBandsByPosition,
  type ValueBandPosition,
} from "@/lib/fpl/insights/value-bands";

const POS_LABEL_KEY: Record<ValueBandPosition, string> = {
  GKP: "posGKP",
  DEF: "posDEF",
  MID: "posMID",
  FWD: "posFWD",
};

const POS_BLURB_KEY: Record<ValueBandPosition, string> = {
  GKP: "hubPosGKP",
  DEF: "hubPosDEF",
  MID: "hubPosMID",
  FWD: "hubPosFWD",
};

export function BestOfPositionHub() {
  const t = useTranslations("fplInsights.bestOfPosition");
  const grouped = groupValueBandsByPosition();

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted-foreground">{t("hubIntro")}</p>

      {VALUE_BAND_POSITION_ORDER.map((pos) => {
        const bands = grouped.get(pos) ?? [];
        return (
          <section key={pos} className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t(POS_LABEL_KEY[pos] as "posMID")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(POS_BLURB_KEY[pos] as "hubPosMID")}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {bands.map((band) => {
                const price = formatValueBandPrice(band.minPrice);
                return (
                  <Link
                    key={band.id}
                    href={band.href}
                    className="rounded-xl border border-border bg-card px-3.5 py-3 no-underline transition-colors hover:border-brand-accent/35 hover:bg-brand-accent/5"
                  >
                    <div className="text-sm font-semibold text-foreground">
                      {t("bandCardTitle", {
                        price,
                        position: t(POS_LABEL_KEY[pos] as "posMID"),
                      })}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t("bandCardCta")}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
