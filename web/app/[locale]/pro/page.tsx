import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FounderPackOffer } from "@/components/billing/founder-pack-offer";
import { getAuthUser } from "@/lib/auth/session";
import {
  FOUNDER_PACK_PRICE_CNY,
  GW_NOTE_PRICE_CNY,
  founderPackIsPublic,
} from "@/lib/billing/founder-pack";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function FounderPackPage({ params }: Props) {
  setRequestLocale(params.locale);
  if (!founderPackIsPublic()) {
    redirect("/");
  }
  const t = await getTranslations({ locale: params.locale, namespace: "founderPack" });
  const common = await getTranslations("common");
  const user = await getAuthUser();

  return (
    <PageShell
      backHref="/"
      backLabel={common("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="2xl"
    >
      <FounderPackOffer
        signedInEmail={user?.email ?? null}
        labels={{
          chooseSku: t("chooseSku"),
          skuATitle: t("skuATitle"),
          skuAPrice: t("skuAPrice", { n: GW_NOTE_PRICE_CNY }),
          skuABody: t("skuABody"),
          skuBTitle: t("skuBTitle"),
          skuBPrice: t("skuBPrice", { n: FOUNDER_PACK_PRICE_CNY }),
          skuBBody: t("skuBBody"),
          sampleDownload: t("sampleDownload"),
          includesTitle: t("includesTitle"),
          includesA: [
            t("includeA1"),
            t("includeA2"),
            t("includeA3"),
            t("includeA4"),
          ],
          includesB: [
            t("includePro"),
            t("includeNote"),
            t("includeMini"),
            t("includeMotw"),
          ],
          addonsTitle: t("addonsTitle"),
          addons: [
            t("addonLeague"),
            t("addonChip"),
            t("addonDgw"),
            t("addonRevise"),
            t("addonConsult"),
          ],
          stepsTitle: t("stepsTitle"),
          steps: [t("step1"), t("step2"), t("step3"), t("step4")],
          payTitle: t("payTitle"),
          payBody: t("payBody"),
          wechatLabel: t("wechatLabel"),
          signedInAs: t("signedInAs"),
          note: t("note"),
          wechatIdLabel: t("wechatIdLabel"),
          wechatIdPlaceholder: t("wechatIdPlaceholder"),
          contactEmailLabel: t("contactEmailLabel"),
          contactEmailPlaceholder: t("contactEmailPlaceholder"),
          submit: t("submit"),
          submitting: t("submitting"),
          submitted: t("submitted"),
          submitError: t("submitError"),
          alreadyPro: t("alreadyPro"),
          needWechat: t("needWechat"),
          needEmail: t("needEmail"),
          signupTitle: t("signupTitle"),
          signupBody: t("signupBody"),
          signupCta: t("signupCta"),
          signupLater: t("signupLater"),
        }}
      />
    </PageShell>
  );
}

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "founderPack",
  });
  return {
    title: t("title"),
    description: t("description"),
  };
}
