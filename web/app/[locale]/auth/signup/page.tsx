import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HomeBackLink } from "@/components/home-back-link";
import { AuthForm } from "@/components/auth/auth-form";

export default async function SignupPage() {
  const t = await getTranslations("auth");
  const common = await getTranslations("common");

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <HomeBackLink label={common("backHome")} />
      <div className="flex flex-col gap-6">
        <AuthForm mode="signup" />
        <p className="text-center text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link href="/auth/login" className="text-brand-accent hover:underline">
            {t("loginLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
