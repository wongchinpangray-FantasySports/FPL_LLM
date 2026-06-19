import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { WcFantasyApp } from "@/components/worldcup/wc-fantasy-app";

export const dynamic = "force-dynamic";

export default async function WorldCupPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "worldcupIndex" });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8">
      <div>
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-brand-accent"
        >
          {t("backHome")}
        </Link>
      </div>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <WcFantasyApp />
      </Suspense>
    </div>
  );
}
