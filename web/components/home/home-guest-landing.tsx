"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { NewsThumb } from "@/components/news/news-thumb";
import { proxiedNewsImageUrl } from "@/lib/news-image";
import type { WcNewsItem } from "@/lib/wc/news-feeds";

/** Soft card gradients — distinct tints, readable in light and dark themes. */
const FEATURE_GRADIENTS = [
  "border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-card/55 to-card/35 hover:border-emerald-400/40",
  "border-sky-500/25 bg-gradient-to-br from-sky-500/15 via-card/55 to-card/35 hover:border-sky-400/40",
  "border-violet-500/25 bg-gradient-to-br from-violet-500/15 via-card/55 to-card/35 hover:border-violet-400/40",
] as const;

const NEWS_GRADIENTS = [
  "border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card/45 to-card/30 hover:border-emerald-400/35",
  "border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-card/45 to-card/30 hover:border-sky-400/35",
  "border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card/45 to-card/30 hover:border-amber-400/35",
  "border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-card/45 to-card/30 hover:border-violet-400/35",
] as const;

function GuestNewsCard({ item, index }: { item: WcNewsItem; index: number }) {
  const hasImage = Boolean(proxiedNewsImageUrl(item.image_url));

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex w-[16rem] shrink-0 snap-start gap-3 rounded-lg border px-3 py-3 no-underline transition-[border-color,box-shadow] hover:shadow-sm sm:w-[18rem]",
        NEWS_GRADIENTS[index % NEWS_GRADIENTS.length],
      )}
    >
      {hasImage ? (
        <NewsThumb
          imageUrl={item.image_url}
          outlet={item.outlet}
          size={48}
          className="rounded-md"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {item.outlet}
        </p>
        <p className="mt-1 line-clamp-3 text-sm font-medium leading-snug text-foreground group-hover:text-brand-accent">
          {item.title}
        </p>
      </div>
    </a>
  );
}

function FeatureRow({
  href,
  title,
  body,
  gradient,
}: {
  href: string;
  title: string;
  body: string;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-start justify-between gap-4 overflow-hidden rounded-lg border px-4 py-3.5 no-underline transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:shadow-md",
        gradient,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 100% 0%, rgba(var(--brand-accent-rgb), 0.12), transparent 55%)",
        }}
      />
      <div className="relative min-w-0">
        <h2 className="text-sm font-semibold text-foreground group-hover:text-brand-accent">
          {title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <span
        className="relative mt-0.5 shrink-0 text-sm text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-accent"
        aria-hidden
      >
        →
      </span>
    </Link>
  );
}

export function HomeGuestLanding({ news }: { news: WcNewsItem[] }) {
  const t = useTranslations("home");

  const features = [
    {
      title: t("guestFeature1Title"),
      body: t("guestFeature1Body"),
      href: "/fpl",
    },
    {
      title: t("guestFeature2Title"),
      body: t("guestFeature2Body"),
      href: "/chat",
    },
    {
      title: t("guestFeature3Title"),
      body: t("guestFeature3Body"),
      href: "/planner",
    },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-2 md:gap-8">
      <section className="relative overflow-hidden rounded-xl border border-brand-accent/20 bg-gradient-to-br from-brand-accent/12 via-card/60 to-card/40 px-5 py-6 md:px-6 md:py-7">
        <div
          className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full opacity-40 blur-3xl"
          aria-hidden
          style={{ background: "rgba(var(--brand-accent-rgb), 0.35)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/3 h-32 w-48 rounded-full opacity-25 blur-3xl"
          aria-hidden
          style={{ background: "rgba(56, 189, 248, 0.25)" }}
        />
        <div className="relative">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand-accent">
          {t("guestEyebrow")}
        </p>
        <h1 className="mt-2 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
          {t("guestHeroTitle")}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("guestHeroBody")}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Link href="/auth/signup" className={cn(buttonVariants({ size: "sm" }), "no-underline")}>
            {t("guestRegister")}
          </Link>
          <Link
            href="/auth/login"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "no-underline")}
          >
            {t("guestLogin")}
          </Link>
          <Link
            href="/fpl"
            className="text-xs font-medium text-muted-foreground hover:text-brand-accent no-underline"
          >
            {t("guestBrowseFpl")} →
          </Link>
        </div>
        </div>
      </section>

      <section className="grid gap-2 md:grid-cols-3 md:gap-3">
        {features.map((feature, index) => (
          <FeatureRow
            key={feature.href}
            href={feature.href}
            title={feature.title}
            body={feature.body}
            gradient={FEATURE_GRADIENTS[index % FEATURE_GRADIENTS.length]}
          />
        ))}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("guestNewsTitle")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("guestNewsBody")}</p>
          </div>
          <Link
            href="/news"
            className="text-xs font-medium text-brand-accent hover:underline no-underline"
          >
            {t("guestNewsAll")} →
          </Link>
        </div>

        {news.length === 0 ? (
          <p className="rounded-lg border border-border bg-card/40 px-4 py-6 text-sm text-muted-foreground">
            {t("newsEmpty")}
          </p>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] snap-x snap-mandatory [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <div className="flex gap-2.5">
              {news.map((item, index) => (
                <GuestNewsCard key={item.id} item={item} index={index} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
