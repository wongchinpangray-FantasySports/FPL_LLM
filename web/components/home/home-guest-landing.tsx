"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { NewsThumb } from "@/components/news/news-thumb";
import { proxiedNewsImageUrl } from "@/lib/news-image";
import type { WcNewsItem } from "@/lib/wc/news-feeds";

function GuestNewsCard({ item }: { item: WcNewsItem }) {
  const hasImage = Boolean(proxiedNewsImageUrl(item.image_url));

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex w-[16rem] shrink-0 snap-start gap-3 rounded-lg border border-border bg-card/40 px-3 py-3 no-underline transition-colors hover:border-brand-accent/25 hover:bg-card/70 sm:w-[18rem]"
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
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-4 rounded-lg border border-border bg-card/40 px-4 py-3.5 no-underline transition-colors hover:border-brand-accent/25 hover:bg-card/70"
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground group-hover:text-brand-accent">
          {title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <span
        className="mt-0.5 shrink-0 text-sm text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-accent"
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
      <section className="rounded-xl border border-border bg-card/50 px-5 py-6 md:px-6 md:py-7">
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
      </section>

      <section className="grid gap-2 md:grid-cols-3 md:gap-3">
        {features.map((feature) => (
          <FeatureRow
            key={feature.href}
            href={feature.href}
            title={feature.title}
            body={feature.body}
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
