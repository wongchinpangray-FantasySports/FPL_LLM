import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function AdminPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations("admin");
  const common = await getTranslations("common");

  return (
    <PageShell
      backHref="/"
      backLabel={common("backHome")}
      title={t("title")}
      width="4xl"
    >
      <AdminUsersPanel locale={params.locale} />
    </PageShell>
  );
}
