import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { SharePreviewCard } from "@/components/share/share-preview-card";
import { ShareGateModal } from "@/components/share/share-gate-modal";
import { getAuthUser } from "@/lib/auth/session";
import { getShareByCode, hasShareView } from "@/lib/share/store";
import { loadSharePreview } from "@/lib/share/preview";
import { SHARE_VISITOR_COOKIE, isShareVisitorId } from "@/lib/share/visitor";
import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string; code: string } };

export async function generateMetadata({ params }: Props) {
  const link = await getShareByCode(params.code).catch(() => null);
  return {
    title: link?.title ? `${link.title} · FALEAGUE` : "FALEAGUE",
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

  return (
    <PageShell width="2xl">
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
