import { getTranslations } from "next-intl/server";
import { EntryIdForm } from "@/components/entry-id-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function HomePage() {
  const t = await getTranslations("home");

  const features = [
    { title: t("feature1Title"), body: t("feature1Body") },
    { title: t("feature2Title"), body: t("feature2Body") },
    { title: t("feature3Title"), body: t("feature3Body") },
  ];

  return (
    <div className="flex flex-col gap-12 md:gap-24">
      <section className="flex max-w-3xl flex-col items-start gap-6 md:gap-8">
        <span className="rounded-full border border-brand-accent/25 bg-brand-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-brand-accent">
          {t("badge")}
        </span>
        <h1 className="text-3xl font-semibold leading-[1.08] tracking-tight text-white sm:text-4xl md:text-6xl md:leading-[1.05]">
          {t("titleLead")}{" "}
          <span className="bg-gradient-to-r from-brand-accent to-emerald-300 bg-clip-text text-transparent">
            {t("titleAccent")}
          </span>
          .
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
          {t("subtitle")}
        </p>
        <div className="w-full max-w-xl rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-sm sm:rounded-2xl sm:p-5 md:p-6">
          <EntryIdForm />
          <p className="mt-3 text-xs text-slate-500">
            {t("entryHint")}{" "}
            <span className="text-slate-400">fantasy.premierleague.com</span>.
          </p>
        </div>
        <Link href="/chat" className="inline-flex">
          <Button variant="secondary" size="lg">
            {t("openChat")}
          </Button>
        </Link>
      </section>

      <section>
        <h2 className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
          {t("featuresTitle")}
        </h2>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-3 md:gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] transition-colors hover:border-brand-accent/20 hover:bg-white/[0.05] sm:rounded-2xl sm:p-5 md:p-6"
            >
              <h3 className="mb-2 font-semibold text-white transition-colors group-hover:text-brand-accent/95">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
