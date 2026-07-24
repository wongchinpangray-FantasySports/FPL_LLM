import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HomeBackLink } from "@/components/home-back-link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");
  const common = await getTranslations("common");

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <HomeBackLink label={common("backHome")} />
      <div className="flex flex-col gap-6">
        <ResetPasswordForm />
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-brand-accent hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
