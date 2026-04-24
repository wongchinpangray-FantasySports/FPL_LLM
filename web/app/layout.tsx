import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "FPL LLM — your AI Fantasy Premier League analyst",
  description:
    "AI FPL help using live data — captains, transfers, fixtures.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-brand-ink/75 backdrop-blur-xl">
          <div className="container flex flex-wrap items-center justify-between gap-4 py-3.5 md:py-4">
            <Link
              href="/"
              className="group flex items-center gap-2.5 font-semibold tracking-tight text-white"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-brand-accent shadow-[0_0_14px_rgba(0,255,135,0.85)] transition-transform group-hover:scale-110"
                aria-hidden
              />
              <span>FPL LLM</span>
            </Link>
            <SiteNav />
          </div>
        </header>
        <main className="container flex w-full flex-1 flex-col py-8 md:py-10 lg:py-12">
          {children}
        </main>
        <footer className="border-t border-white/[0.06] bg-brand-ink/40">
          <div className="container py-10 text-xs text-slate-500">
            <p>Unofficial · not affiliated with the Premier League or FPL.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
