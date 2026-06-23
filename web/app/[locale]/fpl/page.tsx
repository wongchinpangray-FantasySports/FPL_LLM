import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { FplHub } from "@/components/fpl/fpl-hub";

type Props = { params: { locale: string } };

export default async function FplPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplHub" });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 pb-8">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-brand-accent"
      >
        {t("backHome")}
      </Link>
      <PageHeader title={t("title")} description={t("description")} />
      <FplHub />
    </div>
  );
}
