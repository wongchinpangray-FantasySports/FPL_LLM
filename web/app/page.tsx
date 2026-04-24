import Link from "next/link";
import { EntryIdForm } from "@/components/entry-id-form";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Live data",
    body: "Answers tied to the FPL API — form, fixtures, FDR, xG.",
  },
  {
    title: "Picks with reasoning",
    body: "Optimizer on your squad, plus plain-English explanation.",
  },
  {
    title: "Your squad",
    body: "Entry ID → XI, bank, chips — advice in context.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 md:gap-24">
      <section className="flex max-w-3xl flex-col items-start gap-8">
        <span className="rounded-full border border-brand-accent/25 bg-brand-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-brand-accent">
          FALEAGUE AI
        </span>
        <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white md:text-6xl md:leading-[1.05]">
          Win your mini-league with an AI that{" "}
          <span className="bg-gradient-to-r from-brand-accent to-emerald-300 bg-clip-text text-transparent">
            actually reads the data
          </span>
          .
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-slate-300">
          Live FPL data + your squad — captaincy, transfers, and why.
        </p>
        <div className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-sm md:p-6">
          <EntryIdForm />
          <p className="mt-3 text-xs text-slate-500">
            Entry ID: Points page URL on{" "}
            <span className="text-slate-400">fantasy.premierleague.com</span>.
          </p>
        </div>
        <Link href="/chat" className="inline-flex">
          <Button variant="secondary" size="lg">
            Open chat
          </Button>
        </Link>
      </section>

      <section>
        <h2 className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
          Features
        </h2>
        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] transition-colors hover:border-brand-accent/20 hover:bg-white/[0.05]"
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
