import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthForm } from "@/components/auth/auth-form";

type Props = {
  params: { locale: string };
  searchParams: { next?: string };
};

export default async function LoginPage({ searchParams }: Props) {
  const t = await getTranslations("auth");
  const nextPath = searchParams.next;

  return (
    <div className="flex flex-col gap-6">
      <AuthForm mode="login" nextPath={nextPath} />
      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/auth/signup" className="text-brand-accent hover:underline">
          {t("signupLink")}
        </Link>
      </p>
    </div>
  );
}
