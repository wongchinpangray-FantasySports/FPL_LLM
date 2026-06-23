import { setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { LocaleHtmlLang } from "@/components/locale-html-lang";
import { HomeSignupPrompt } from "@/components/auth/signup-prompt-modal";
import { SiteHeader } from "@/components/site-header";

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = params;
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const t = await getTranslations({ locale, namespace: "footer" });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleHtmlLang locale={locale} />
      <HomeSignupPrompt />
      <SiteHeader />
      <main className="container flex w-full flex-1 flex-col py-5 md:py-8">
        {children}
      </main>
      <footer className="border-t border-border bg-background/40">
        <div className="container py-5 text-xs text-muted-foreground md:py-8">
          <p>{t("legal")}</p>
        </div>
      </footer>
    </NextIntlClientProvider>
  );
}
