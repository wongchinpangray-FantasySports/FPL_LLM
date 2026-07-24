import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HomeBackLink } from "@/components/home-back-link";
import { AuthForm } from "@/components/auth/auth-form";

type Props = {
  params: { locale: string };
  searchParams: { next?: string; error?: string };
};

export default async function LoginPage({ searchParams }: Props) {
  const t = await getTranslations("auth");
  const common = await getTranslations("common");
  const nextPath = searchParams.next;
  const resetError =
    searchParams.error === "invalid_reset_link"
      ? t("resetLinkExpired")
      : null;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <HomeBackLink label={common("backHome")} />
      <div className="flex flex-col gap-6">
        {resetError ? (
          <p className="mx-auto w-full max-w-md rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
            {resetError}
          </p>
        ) : null}
        <AuthForm mode="login" nextPath={nextPath} />
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/auth/forgot-password"
            className="text-brand-accent hover:underline"
          >
            {t("forgotPasswordLink")}
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/auth/signup" className="text-brand-accent hover:underline">
            {t("signupLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
