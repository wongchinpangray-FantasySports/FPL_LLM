import { setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { SiteNav } from "@/components/site-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LocaleHtmlLang } from "@/components/locale-html-lang";

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
  // Explicit locale avoids falling back to defaultLocale (en) when middleware
  // locale is missing from this RSC request (e.g. on Vercel preview).
  const messages = await getMessages({ locale });
  const t = await getTranslations({ locale, namespace: "footer" });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleHtmlLang locale={locale} />
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-brand-ink/75 backdrop-blur-xl">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-3.5 md:py-4">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/"
              className="group flex items-center gap-2.5 font-semibold tracking-tight text-white"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-brand-accent shadow-[0_0_14px_rgba(0,255,135,0.85)] transition-transform group-hover:scale-110"
                aria-hidden
              />
              <span>FALEAGUE AI</span>
            </Link>
            <SiteNav />
          </div>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="container flex w-full flex-1 flex-col py-8 md:py-10 lg:py-12">
        {children}
      </main>
      <footer className="border-t border-white/[0.06] bg-brand-ink/40">
        <div className="container py-10 text-xs text-slate-500">
          <p>{t("legal")}</p>
        </div>
      </footer>
    </NextIntlClientProvider>
  );
}
