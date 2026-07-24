import { getTranslations } from "next-intl/server";
import { HomeBackLink } from "@/components/home-back-link";
import { AccountPanel } from "@/components/account/account-panel";

export default async function AccountPage() {
  const common = await getTranslations("common");

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <HomeBackLink label={common("backHome")} />
      <AccountPanel />
    </div>
  );
}
