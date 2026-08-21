import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { ScoutArticleBody } from "@/components/scout/scout-article-body";
import { ScoutCta } from "@/components/scout/scout-cta";
import { ScoutPageview } from "@/components/scout/scout-pageview";
import { getScoutArticleBySlug } from "@/lib/scout/store";
import { displayScoutBody, displayScoutExcerpt, displayScoutTitle } from "@/lib/scout/zh-status";
import { proxiedNewsImageUrl } from "@/lib/news-image";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string; slug: string } };

export async function generateMetadata({ params }: Props) {
  try {
    const article = await getScoutArticleBySlug(params.slug);
    if (!article) return {};
    const title = displayScoutTitle(article);
    const description = displayScoutExcerpt(article) || title;
    return { title, description };
  } catch {
    return {};
  }
}

export default async function ScoutArticlePage({ params }: Props) {
  setRequestLocale(params.locale);
  let article;
  try {
    article = await getScoutArticleBySlug(params.slug);
  } catch {
    notFound();
  }
  if (!article) notFound();

  const t = await getTranslations({ locale: params.locale, namespace: "scout" });
  const body = displayScoutBody(article);
  if (!body) notFound();

  const published = article.source_published_at
    ? new Intl.DateTimeFormat(params.locale, { dateStyle: "long" }).format(
        new Date(article.source_published_at),
      )
    : null;

  return (
    <PageShell backHref="/scout" backLabel={t("backList")} width="4xl">
      <ScoutPageview articleId={article.id} slug={article.slug} />
      <article className="flex flex-col gap-5">
        <header className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
            {t("partner")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {displayScoutTitle(article)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {published ? `${published} · ` : ""}
            {article.author ? `${article.author} · ` : ""}
            {t("series." + article.series)}
          </p>
        </header>

        {article.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxiedNewsImageUrl(article.hero_image_url) ?? article.hero_image_url}
            alt=""
            className="max-h-[22rem] w-full rounded-xl object-cover"
          />
        ) : null}

        <ScoutCta
          slug={article.slug}
          articleId={article.id}
          sourceUrl={article.source_url}
          labels={{
            partner: t("partner"),
            premiumTitle: t("ctaPremiumTitle"),
            premiumBody: t("ctaPremiumBody"),
            premiumButton: t("ctaPremiumButton"),
            raterButton: t("ctaRaterButton"),
            originalButton: t("ctaOriginalButton"),
            qrHint: t("ctaQrHint"),
            credit: t("ctaCredit"),
          }}
        />

        <ScoutArticleBody html={body} baseUrl={article.source_url} />

        <ScoutCta
          slug={article.slug}
          articleId={article.id}
          sourceUrl={article.source_url}
          labels={{
            partner: t("partner"),
            premiumTitle: t("ctaPremiumTitle"),
            premiumBody: t("ctaPremiumBody"),
            premiumButton: t("ctaPremiumButton"),
            raterButton: t("ctaRaterButton"),
            originalButton: t("ctaOriginalButton"),
            qrHint: t("ctaQrHint"),
            credit: t("ctaCredit"),
          }}
        />

        <p className="text-xs text-muted-foreground">
          {t("disclaimer")}{" "}
          <Link href="/scout" className="text-brand-accent">
            {t("backList")}
          </Link>
        </p>
      </article>
    </PageShell>
  );
}
