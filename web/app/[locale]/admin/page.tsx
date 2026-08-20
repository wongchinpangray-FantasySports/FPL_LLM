import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function AdminPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations("adminScout");
  const common = await getTranslations("common");

  return (
    <PageShell
      backHref="/"
      backLabel={common("backHome")}
      title={t("pageTitle")}
      width="6xl"
    >
      <AdminDashboard locale={params.locale} />
    </PageShell>
  );
}
