import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";

type Props = { params: { locale: string } };

export default async function AdminPage({ params }: Props) {
  setRequestLocale(params.locale);
  const user = await getAuthUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    redirect("/");
  }
  return <AdminUsersPanel locale={params.locale} />;
}
