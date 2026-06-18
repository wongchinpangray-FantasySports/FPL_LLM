"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { Link } from "@/i18n/navigation";

export function AccountPanel() {
  const t = useTranslations("account");
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <p className="text-sm text-slate-400">{t("loading")}</p>;
  }

  if (!user) {
    return (
      <p className="text-sm text-slate-400">
        {t("signedOut")}{" "}
        <Link href="/auth/login" className="text-brand-accent hover:underline">
          {t("signIn")}
        </Link>
      </p>
    );
  }

  return (
    <section className="mx-auto max-w-lg rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
      <h1 className="text-xl font-semibold text-white">{t("title")}</h1>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-slate-500">{t("email")}</dt>
          <dd className="text-white">{user.email}</dd>
        </div>
        {profile?.fpl_entry_id ? (
          <div>
            <dt className="text-slate-500">{t("fplEntry")}</dt>
            <dd className="text-white">{profile.fpl_entry_id}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-slate-500">{t("onboarding")}</dt>
          <dd className="text-white">
            {profile?.onboarding_completed_at ? t("complete") : t("incomplete")}
          </dd>
        </div>
      </dl>
      {!profile?.onboarding_completed_at ? (
        <Link
          href="/onboarding"
          className="mt-6 inline-block text-sm text-brand-accent hover:underline"
        >
          {t("finishOnboarding")}
        </Link>
      ) : null}
    </section>
  );
}
