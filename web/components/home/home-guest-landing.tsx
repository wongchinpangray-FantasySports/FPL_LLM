"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { proxiedNewsImageUrl } from "@/lib/news-image";
import type { WcNewsItem } from "@/lib/wc/news-feeds";

const FEATURE_VISUALS = [
  "from-emerald-600/80 via-emerald-900/40 to-[#1a0a2e]",
  "from-cyan-500/70 via-sky-900/50 to-[#1a0a2e]",
  "from-violet-600/70 via-purple-900/50 to-[#1a0a2e]",
] as const;

function GuestNewsCard({ item }: { item: WcNewsItem }) {
  const [imgFailed, setImgFailed] = useState(false);
  const imgSrc = proxiedNewsImageUrl(item.image_url);
  const showImage = Boolean(imgSrc) && !imgFailed;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group w-[13.5rem] shrink-0 snap-start no-underline sm:w-[15rem]"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-[#2a0646]/60 shadow-lg">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc!}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full flex-col justify-end bg-gradient-to-br from-[#3d195b] via-[#2a0646] to-[#12061f] p-4">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
              {item.outlet}
            </span>
            <p className="mt-2 line-clamp-3 text-sm font-semibold leading-snug text-white/90">
              {item.title}
            </p>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        {showImage ? (
          <p className="absolute inset-x-0 bottom-0 line-clamp-3 px-3 pb-3 text-sm font-semibold leading-snug text-white">
            {item.title}
          </p>
        ) : null}
      </div>
    </a>
  );
}

export function HomeGuestLanding({ news }: { news: WcNewsItem[] }) {
  const t = useTranslations("home");

  const features = [
    {
      title: t("guestFeature1Title"),
      body: t("guestFeature1Body"),
      href: "/fpl",
      visual: FEATURE_VISUALS[0],
      glyph: "15",
    },
    {
      title: t("guestFeature2Title"),
      body: t("guestFeature2Body"),
      href: "/chat",
      visual: FEATURE_VISUALS[1],
      glyph: "AI",
    },
    {
      title: t("guestFeature3Title"),
      body: t("guestFeature3Body"),
      href: "/planner",
      visual: FEATURE_VISUALS[2],
      glyph: "GW",
    },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-4 md:gap-10">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#2a0646] shadow-xl">
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#00ff87]/25 via-cyan-500/20 to-violet-600/35"
          aria-hidden
        />
        <div className="absolute -right-16 top-0 h-full w-1/2 bg-gradient-to-l from-white/5 to-transparent" aria-hidden />
        <div className="relative grid gap-8 p-6 md:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:p-10">
          <div className="flex flex-col gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
              {t("guestEyebrow")}
            </p>
            <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              {t("guestHeroTitle")}
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">
              {t("guestHeroBody")}
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/auth/signup"
                className={cn(
                  buttonVariants(),
                  "border-0 bg-white text-[#12061f] hover:bg-white/90 no-underline",
                )}
              >
                {t("guestRegister")}
              </Link>
              <Link
                href="/auth/login"
                className={cn(
                  buttonVariants({ variant: "secondary" }),
                  "border border-white/70 bg-transparent text-white hover:bg-white/10 hover:text-white no-underline",
                )}
              >
                {t("guestLogin")}
              </Link>
            </div>
            <Link
              href="/fpl"
              className="text-sm font-medium text-brand-accent hover:underline no-underline w-fit"
            >
              {t("guestBrowseFpl")} →
            </Link>
          </div>

          <div className="relative hidden min-h-[14rem] lg:block" aria-hidden>
            <div className="absolute inset-y-4 right-0 w-[88%] rounded-2xl bg-gradient-to-br from-brand-accent/20 via-cyan-400/10 to-violet-500/20 blur-sm" />
            <div className="absolute bottom-6 right-4 flex gap-3">
              {["#00ff87", "#6cabdd", "#ef0107", "#ffffff"].map((color, i) => (
                <div
                  key={color}
                  className="flex h-24 w-20 items-end justify-center rounded-xl border border-white/15 pb-3 shadow-lg"
                  style={{
                    background: `linear-gradient(180deg, ${color}33 0%, #1a0a2e 100%)`,
                    transform: `translateY(${i * 6}px) rotate(${i * 4 - 6}deg)`,
                  }}
                >
                  <span className="text-[10px] font-bold text-white/80">FPL</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#2a0646]/80 no-underline transition-colors hover:border-brand-accent/30"
          >
            <div
              className={cn(
                "relative flex h-36 items-center justify-center bg-gradient-to-br",
                feature.visual,
              )}
            >
              <span className="rounded-xl border border-white/20 bg-black/25 px-4 py-2 text-2xl font-black tracking-tight text-white/90 backdrop-blur-sm">
                {feature.glyph}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-5">
              <h2 className="text-lg font-semibold text-white">{feature.title}</h2>
              <p className="text-sm leading-relaxed text-white/65">{feature.body}</p>
              <span className="mt-auto pt-2 text-sm font-medium text-brand-accent group-hover:underline">
                {t("guestFeatureCta")} →
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {t("guestNewsTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("guestNewsBody")}</p>
          </div>
          <Link
            href="/news"
            className="text-sm font-medium text-brand-accent hover:underline no-underline"
          >
            {t("guestNewsAll")} →
          </Link>
        </div>

        {news.length === 0 ? (
          <p className="rounded-xl border border-border bg-card/50 px-4 py-8 text-sm text-muted-foreground">
            {t("newsEmpty")}
          </p>
        ) : (
          <div className="relative -mx-1">
            <div className="flex gap-4 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] snap-x snap-mandatory [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
              {news.map((item) => (
                <GuestNewsCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
