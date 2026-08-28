"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { ffsPremiumBannerForPath } from "@/lib/scout/banners";
import { scoutGoHref } from "@/lib/scout/links";

export function FfsPremiumBanner() {
  const pathname = usePathname() ?? "/";
  const t = useTranslations("scout");
  const { src } = ffsPremiumBannerForPath(pathname);
  const href = scoutGoHref("premium");

  return (
    <aside
      className="mb-4 md:mb-5"
      aria-label={t("bannerAria")}
      data-ffs-banner="premium"
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t("bannerPartner")}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-opacity hover:opacity-95"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={t("bannerAlt")}
          width={1200}
          height={400}
          className="mx-auto block h-auto max-h-40 w-full object-contain sm:max-h-44 md:max-h-48"
          loading="lazy"
          decoding="async"
        />
      </a>
    </aside>
  );
}
