import { getTranslations } from "next-intl/server";
import { HomeBackLink } from "@/components/home-back-link";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const t = await getTranslations("onboarding");
  const common = await getTranslations("common");

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <HomeBackLink label={common("backHome")} />
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <OnboardingWizard />
      </div>
    </div>
  );
}
