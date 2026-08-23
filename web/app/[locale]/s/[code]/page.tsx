import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { SharePreviewCard } from "@/components/share/share-preview-card";
import { ShareCrawlerTags } from "@/components/share/share-crawler-tags";
import { ShareGateModal } from "@/components/share/share-gate-modal";
import { getAuthUser } from "@/lib/auth/session";
import { getShareByCode, hasShareView } from "@/lib/share/store";
import { loadSharePreview } from "@/lib/share/preview";
import {
  shareCardImagePath,
  shareOgDescription,
  shareOgTitle,
  sharePagePath,
  shareSiteOrigin,
} from "@/lib/share/card-copy";
import { SHARE_VISITOR_COOKIE, isShareVisitorId } from "@/lib/share/visitor";
import { redirect } from "@/i18n/navigation";
import type { SharePreview } from "@/lib/share/types";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string; code: string } };

async function previewForCode(code: string): Promise<{
  title: string;
  description: string;
  image: string;
  url: string;
} | null> {
  const link = await getShareByCode(code).catch(() => null);
  if (!link) return null;
  const preview: SharePreview = await loadSharePreview({
    kind: link.kind,
    target_path: link.target_path,
    title: link.title,
    ref_id: link.ref_id,
  }).catch(() => ({
    kind: link.kind,
    title: link.title || "FALEAGUE",
    subtitle: null,
    href: link.target_path,
    items: [],
  }));
  const origin = shareSiteOrigin();
  return {
    title: shareOgTitle(preview),
    description: shareOgDescription(preview),
    image: `${origin}${shareCardImagePath(link.code)}`,
    url: `${origin}${sharePagePath(link.code)}`,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await previewForCode(params.code);
  const title = card?.title ?? "FALEAGUE";
  const description =
    card?.description ?? "打开 FALEAGUE 查看完整内容";
  const image = card?.image;
  return {
    title,
    description,
    alternates: card ? { canonical: card.url } : undefined,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: "FALEAGUE",
      title,
      description,
      url: card?.url,
      images: image
        ? [
            {
              url: image,
              width: 1200,
              height: 630,
              type: "image/png",
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
    other: image
      ? {
          "og:image:width": "1200",
          "og:image:height": "630",
        }
      : undefined,
  };
}

export default async function ShareLandingPage({ params }: Props) {
  setRequestLocale(params.locale);
  const link = await getShareByCode(params.code).catch(() => null);
  if (!link) notFound();

  const user = await getAuthUser();
  if (user) {
    redirect({ href: link.target_path, locale: params.locale });
  }

  const visitor = cookies().get(SHARE_VISITOR_COOKIE)?.value;
  const seen =
    isShareVisitorId(visitor) &&
    (await hasShareView(link.id, visitor).catch(() => false));
  const previewOnce = !seen;

  const preview = await loadSharePreview({
    kind: link.kind,
    target_path: link.target_path,
    title: link.title,
    ref_id: link.ref_id,
  }).catch(() => ({
    kind: link.kind,
    title: link.title,
    subtitle: null,
    href: link.target_path,
    items: [],
  }));

  const t = await getTranslations({ locale: params.locale, namespace: "share" });
  const origin = shareSiteOrigin();
  const image = `${origin}${shareCardImagePath(link.code)}`;
  const ogTitle = shareOgTitle(preview);
  const ogDescription = shareOgDescription(preview);

  return (
    <PageShell width="2xl">
      <ShareCrawlerTags
        title={ogTitle}
        description={ogDescription}
        image={image}
      />
      <SharePreviewCard
        preview={preview}
        locked={!previewOnce}
        labels={{ lockedHint: t("emptyPreview") }}
      />
      <ShareGateModal
        code={link.code}
        href={link.target_path}
        previewOnce={previewOnce}
        labels={{
          title: t("gateTitle"),
          bodyOnce: t("gateBodyOnce"),
          bodyRepeat: t("gateBodyRepeat"),
          signup: t("signup"),
          login: t("login"),
          stay: t("stay"),
        }}
      />
    </PageShell>
  );
}
