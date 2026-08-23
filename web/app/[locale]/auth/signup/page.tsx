import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HomeBackLink } from "@/components/home-back-link";
import { AuthForm } from "@/components/auth/auth-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const t = await getTranslations("auth");
  const common = await getTranslations("common");
  const nextPath = searchParams.next;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <HomeBackLink label={common("backHome")} />
      <div className="flex flex-col gap-6">
        <AuthForm mode="signup" nextPath={nextPath} />
        <p className="text-center text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link
            href={nextPath ? `/auth/login?next=${encodeURIComponent(nextPath)}` : "/auth/login"}
            className="text-brand-accent hover:underline"
          >
            {t("loginLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
