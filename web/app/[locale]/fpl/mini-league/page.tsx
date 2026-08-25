import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { MiniLeagueApp } from "@/components/fpl/mini-league/mini-league-app";
import { MiniLeagueBetaGate } from "@/components/fpl/mini-league/mini-league-beta-gate";
import { InsightsPaywall } from "@/components/fpl/insights/insights-paywall";
import { FplEntryLinkForm } from "@/components/account/fpl-entry-link-form";
import { getAuthUser, getUserProfile } from "@/lib/auth/session";
import {
  claimMiniLeagueInvite,
  resolveMiniLeagueAccess,
} from "@/lib/fpl/mini-league/beta";

export const dynamic = "force-dynamic";

type Props = {
  params: { locale: string };
  searchParams?: { invite?: string; entry?: string };
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function MiniLeaguePage({ params, searchParams }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "miniLeague" });
  const user = await getAuthUser();
  const profile = user ? await getUserProfile(user.id) : null;
  const inviteToken = firstParam(searchParams?.invite).trim();
  const entryParam = firstParam(searchParams?.entry).trim();
  const localPreview =
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_LOCAL_DASHBOARD_PREVIEW === "1";

  let claimError: string | null = null;
  if (user && inviteToken) {
    const claimed = await claimMiniLeagueInvite(user, inviteToken);
    if (claimed.ok) {
      const next = entryParam
        ? `/fpl/mini-league?entry=${encodeURIComponent(entryParam)}`
        : "/fpl/mini-league";
      redirect({ href: next, locale: params.locale });
    } else {
      claimError = claimed.error;
    }
  }

  const access = await resolveMiniLeagueAccess(
    user ? { id: user.id, email: user.email ?? null } : null,
  );
  const returnPath = inviteToken
    ? `/fpl/mini-league?invite=${encodeURIComponent(inviteToken)}`
    : "/fpl/mini-league";

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="6xl"
      actions={
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          {t("badgeBeta")}
        </span>
      }
    >
      {!localPreview && !access.allowed ? (
        access.reason === "premium_required" ? (
          <InsightsPaywall
            title={t("paywallTitle")}
            body={t("paywallBody")}
            signInLabel={t("paywallSignIn")}
            upgradeLabel={t("paywallUpgrade")}
            returnPath="/fpl/mini-league"
            locale={params.locale}
          />
        ) : (
          <MiniLeagueBetaGate
            signedIn={Boolean(user)}
            reason={
              access.reason === "expired" ||
              access.reason === "revoked" ||
              access.reason === "unauthenticated"
                ? access.reason
                : "beta_required"
            }
            claimError={claimError}
            inviteToken={inviteToken || null}
            returnPath={returnPath}
          />
        )
      ) : profile?.fpl_entry_id || localPreview ? (
        <MiniLeagueApp
          linkedEntryId={profile?.fpl_entry_id ?? null}
          beta={access}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <p className="mb-4 text-sm text-muted-foreground">{t("needEntry")}</p>
          <FplEntryLinkForm />
          <p className="mt-4 text-xs text-muted-foreground">
            {t("needEntryHint")}{" "}
            <Link href="/account" className="text-brand-accent hover:underline">
              {t("accountLink")}
            </Link>
          </p>
        </div>
      )}
    </PageShell>
  );
}

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "miniLeague",
  });
  return {
    title: t("title"),
    description: t("description"),
  };
}
